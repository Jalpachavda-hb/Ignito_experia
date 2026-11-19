// Task checks for AWS console labs (docs/aws-console-labs.md §5.2 "validate").
// Each check runs with the read-only VlabValidatorRole in the student's own sandbox account,
// so it may look at the whole account. A check returns { passed, message }.

import {
  EC2Client,
  DescribeKeyPairsCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  DescribeVolumesCommand,
} from "@aws-sdk/client-ec2";
import {
  S3Client,
  HeadBucketCommand,
  GetBucketLocationCommand,
  HeadObjectCommand,
  GetBucketVersioningCommand,
  ListObjectVersionsCommand,
  GetBucketLifecycleConfigurationCommand,
  GetBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import {
  IAMClient,
  ListAttachedGroupPoliciesCommand,
  GetLoginProfileCommand,
  ListGroupsForUserCommand,
  GetAccountPasswordPolicyCommand,
  GetRoleCommand,
  ListAttachedUserPoliciesCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
} from "@aws-sdk/client-iam";

const pass = (message) => ({ passed: true, message });
const fail = (message) => ({ passed: false, message });
const isNotFound = (err) =>
  ["NotFound", "NoSuchEntity", "NoSuchBucket", "NoSuchKey", "NoSuchLifecycleConfiguration", "NoSuchBucketPolicy",
    "InvalidKeyPair.NotFound", "InvalidGroup.NotFound"].includes(err?.name) || err?.$metadata?.httpStatusCode === 404;

const tagValue = (resource, key) => (resource.Tags || []).find((t) => t.Key === key)?.Value;

// ---------- EC2 ----------
const findWebServer = async (ec2) => {
  const res = await ec2.send(new DescribeInstancesCommand({
    Filters: [
      { Name: "tag:Name", Values: ["web-server"] },
      { Name: "instance-state-name", Values: ["pending", "running", "stopping", "stopped"] },
    ],
  }));
  return (res.Reservations || []).flatMap((r) => r.Instances || [])[0] || null;
};

const ec2Checks = {
  "ec2-keypair": async ({ ec2 }) => {
    try {
      await ec2.send(new DescribeKeyPairsCommand({ KeyNames: ["lab-key"] }));
      return pass("Found key pair lab-key");
    } catch (err) {
      if (isNotFound(err)) return fail("No key pair named lab-key");
      throw err;
    }
  },
  "ec2-sg": async ({ ec2 }) => {
    const res = await ec2.send(new DescribeSecurityGroupsCommand({ Filters: [{ Name: "group-name", Values: ["web-sg"] }] }));
    const sg = res.SecurityGroups?.[0];
    if (!sg) return fail("No security group named web-sg");
    const ports = new Set();
    for (const p of sg.IpPermissions || []) {
      if (p.IpProtocol === "-1") { ports.add(22); ports.add(80); continue; }
      for (const port of [22, 80]) {
        if (Number(p.FromPort) <= port && port <= Number(p.ToPort)) ports.add(port);
      }
    }
    const missing = [22, 80].filter((p) => !ports.has(p));
    return missing.length ? fail(`web-sg has no inbound rule for port ${missing.join(" and ")}`) : pass("web-sg allows ports 22 and 80");
  },
  "ec2-launch": async ({ ec2 }) => {
    const inst = await findWebServer(ec2);
    if (!inst) return fail("No instance tagged Name=web-server");
    const problems = [];
    if (!["t2.micro", "t3.micro"].includes(inst.InstanceType)) problems.push(`type is ${inst.InstanceType}`);
    if (inst.KeyName !== "lab-key") problems.push("not using key pair lab-key");
    if (!(inst.SecurityGroups || []).some((g) => g.GroupName === "web-sg")) problems.push("not in security group web-sg");
    if (problems.length) return fail(`web-server (${inst.InstanceId}): ${problems.join(", ")}`);
    return pass(`Found ${inst.InstanceId} (${inst.State?.Name})`);
  },
  "ec2-volume": async ({ ec2 }) => {
    const inst = await findWebServer(ec2);
    if (!inst) return fail("Launch web-server first");
    const res = await ec2.send(new DescribeVolumesCommand({ Filters: [{ Name: "attachment.instance-id", Values: [inst.InstanceId] }] }));
    const vol = (res.Volumes || []).find((v) => v.Size === 8 && v.VolumeType === "gp3");
    return vol ? pass(`Found ${vol.VolumeId} attached to web-server`) : fail("No 8 GiB gp3 volume attached to web-server");
  },
  "ec2-stop": async ({ ec2 }) => {
    const inst = await findWebServer(ec2);
    if (!inst) return fail("Launch web-server first");
    return inst.State?.Name === "stopped" ? pass("web-server is stopped") : fail(`web-server is ${inst.State?.Name}`);
  },
};

// ---------- S3 ----------
const s3Checks = {
  "s3-bucket": async ({ s3, bucket, region }) => {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err) {
      if (isNotFound(err) || err?.$metadata?.httpStatusCode === 403) return fail(`No bucket named ${bucket} in this account`);
      throw err;
    }
    const loc = await s3.send(new GetBucketLocationCommand({ Bucket: bucket }));
    const bucketRegion = loc.LocationConstraint || "us-east-1";
    return bucketRegion === region ? pass(`Found ${bucket} in ${region}`) : fail(`${bucket} is in ${bucketRegion}, not ${region}`);
  },
  "s3-upload": async ({ s3, bucket }) => {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: "hello.txt" }));
      return pass("Found hello.txt");
    } catch (err) {
      if (isNotFound(err) || err?.$metadata?.httpStatusCode === 403) return fail(`hello.txt not found in ${bucket}`);
      throw err;
    }
  },
  "s3-versioning": async ({ s3, bucket }) => {
    try {
      const v = await s3.send(new GetBucketVersioningCommand({ Bucket: bucket }));
      if (v.Status !== "Enabled") return fail("Versioning is not enabled");
      const versions = await s3.send(new ListObjectVersionsCommand({ Bucket: bucket, Prefix: "hello.txt" }));
      const count = (versions.Versions || []).filter((x) => x.Key === "hello.txt").length;
      return count >= 2 ? pass(`hello.txt has ${count} versions`) : fail("Upload hello.txt again to create a second version");
    } catch (err) {
      if (isNotFound(err)) return fail(`Bucket ${bucket} not found`);
      throw err;
    }
  },
  "s3-lifecycle": async ({ s3, bucket }) => {
    try {
      const res = await s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
      const ok = (res.Rules || []).some(
        (r) => r.Status === "Enabled" &&
          (r.Transitions || []).some((t) => String(t.StorageClass).startsWith("GLACIER") && Number(t.Days) === 30),
      );
      return ok ? pass("Found a rule moving objects to Glacier after 30 days") : fail("No enabled rule moving objects to Glacier after 30 days");
    } catch (err) {
      if (isNotFound(err)) return fail("No lifecycle rules on the bucket");
      throw err;
    }
  },
  "s3-policy": async ({ s3, bucket }) => {
    try {
      const res = await s3.send(new GetBucketPolicyCommand({ Bucket: bucket }));
      const policy = JSON.parse(res.Policy || "{}");
      const statements = [].concat(policy.Statement || []);
      const ok = statements.some((st) => {
        if (st.Effect !== "Deny") return false;
        const bool = st.Condition?.Bool || {};
        return String(bool["aws:SecureTransport"]).toLowerCase() === "false";
      });
      return ok ? pass("Bucket policy denies non-HTTPS requests") : fail("No Deny statement with aws:SecureTransport = false");
    } catch (err) {
      if (isNotFound(err)) return fail("The bucket has no policy");
      throw err;
    }
  },
};

// ---------- IAM ----------
const iamChecks = {
  "iam-group": async ({ iam }) => {
    try {
      const res = await iam.send(new ListAttachedGroupPoliciesCommand({ GroupName: "developers" }));
      const ok = (res.AttachedPolicies || []).some((p) => p.PolicyName === "AmazonS3ReadOnlyAccess");
      return ok ? pass("developers has AmazonS3ReadOnlyAccess") : fail("Attach AmazonS3ReadOnlyAccess to developers");
    } catch (err) {
      if (isNotFound(err)) return fail("No group named developers");
      throw err;
    }
  },
  "iam-user": async ({ iam }) => {
    try {
      const groups = await iam.send(new ListGroupsForUserCommand({ UserName: "dev1" }));
      if (!(groups.Groups || []).some((g) => g.GroupName === "developers")) return fail("dev1 is not in developers");
      try {
        await iam.send(new GetLoginProfileCommand({ UserName: "dev1" }));
      } catch (err) {
        if (isNotFound(err)) return fail("dev1 has no console password");
        throw err;
      }
      return pass("dev1 is in developers and has a console password");
    } catch (err) {
      if (isNotFound(err)) return fail("No user named dev1");
      throw err;
    }
  },
  "iam-password-policy": async ({ iam }) => {
    try {
      const res = await iam.send(new GetAccountPasswordPolicyCommand({}));
      const p = res.PasswordPolicy || {};
      const problems = [];
      if (Number(p.MinimumPasswordLength) < 12) problems.push(`minimum length is ${p.MinimumPasswordLength}`);
      if (!p.RequireSymbols) problems.push("symbols are not required");
      return problems.length ? fail(problems.join(", ")) : pass("Password policy meets the requirements");
    } catch (err) {
      if (isNotFound(err)) return fail("No account password policy is set");
      throw err;
    }
  },
  "iam-role": async ({ iam }) => {
    try {
      const res = await iam.send(new GetRoleCommand({ RoleName: "ec2-s3-reader" }));
      const doc = JSON.parse(decodeURIComponent(res.Role?.AssumeRolePolicyDocument || "{}"));
      const ok = [].concat(doc.Statement || []).some((st) => {
        const svc = [].concat(st.Principal?.Service || []);
        return st.Effect === "Allow" && svc.includes("ec2.amazonaws.com");
      });
      return ok ? pass("ec2-s3-reader is trusted by ec2.amazonaws.com") : fail("ec2-s3-reader's trust policy doesn't allow ec2.amazonaws.com");
    } catch (err) {
      if (isNotFound(err)) return fail("No role named ec2-s3-reader");
      throw err;
    }
  },
  "iam-custom-policy": async ({ iam }) => {
    try {
      const res = await iam.send(new ListAttachedUserPoliciesCommand({ UserName: "dev1" }));
      const customer = (res.AttachedPolicies || []).filter((p) => !p.PolicyArn.startsWith("arn:aws:iam::aws:"));
      for (const p of customer) {
        const pol = await iam.send(new GetPolicyCommand({ PolicyArn: p.PolicyArn }));
        const ver = await iam.send(new GetPolicyVersionCommand({ PolicyArn: p.PolicyArn, VersionId: pol.Policy.DefaultVersionId }));
        const doc = JSON.parse(decodeURIComponent(ver.PolicyVersion?.Document || "{}"));
        const ok = [].concat(doc.Statement || []).some((st) => {
          const actions = [].concat(st.Action || []);
          const resources = [].concat(st.Resource || []);
          return st.Effect === "Allow" && actions.includes("s3:ListBucket") &&
            resources.length > 0 && resources.every((r) => r.startsWith("arn:aws:s3:::") && !r.includes("*"));
        });
        if (ok) return pass(`${p.PolicyName} allows s3:ListBucket on one bucket`);
      }
      return fail("dev1 has no customer policy allowing s3:ListBucket on a specific bucket");
    } catch (err) {
      if (isNotFound(err)) return fail("No user named dev1");
      throw err;
    }
  },
};

const CHECKS = { "aws-ec2": ec2Checks, "aws-s3": s3Checks, "aws-iam": iamChecks };

/** Runs every task check for the lab. `credentials` are the validator role's temporary credentials. */
export const runValidation = async ({ labType, tasks, credentials, region, bucketPrefix }) => {
  const clientConfig = { region, credentials };
  const ctx = {
    ec2: new EC2Client(clientConfig),
    s3: new S3Client(clientConfig),
    iam: new IAMClient({ ...clientConfig, region: "us-east-1" }),
    bucket: `${bucketPrefix}-data`,
    region,
  };
  const checks = CHECKS[labType] || {};
  const results = [];
  for (const task of tasks) {
    const check = checks[task.id];
    let result;
    try {
      result = check ? await check(ctx) : fail("No automatic check for this task");
    } catch (err) {
      result = fail(`Could not check this task right now (${err.name || "error"})`);
    }
    results.push({ id: task.id, title: task.title, ...result });
  }
  return { score: results.filter((r) => r.passed).length, total: results.length, tasks: results };
};
