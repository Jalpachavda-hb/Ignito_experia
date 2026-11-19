// AWS console labs (docs/aws-console-labs.md): EC2, S3 and IAM in a leased sandbox account.
//
// Infra values come from `terraform output` of terraform-aws-sandbox/ (infra repo).
// The feature is off until AWS_LABS_ENABLED=true and the required values are set.

const env = (name, fallback = "") => process.env[name] || fallback;

export const awsLabsInfra = {
  enabled: env("AWS_LABS_ENABLED").toLowerCase() === "true",
  region: env("AWS_LABS_REGION", "ap-south-1"),
  poolTable: env("AWS_SANDBOX_POOL_TABLE", "vlab-dev-aws-sandbox-accounts"),
  poolStatusIndex: env("AWS_SANDBOX_POOL_STATUS_INDEX", "status-index"),
  sessionsTable: env("AWS_LABS_SESSIONS_TABLE", env("SESSIONS_TABLE_NAME", "vlab-sessions")),
  sessionsByStudentIndex: env("AWS_LABS_SESSIONS_BY_STUDENT_INDEX", "byStudent"),
  schedulerGroup: env("AWS_LABS_SCHEDULER_GROUP", "vlab-dev-aws-labs"),
  schedulerRoleArn: env("AWS_LABS_SCHEDULER_ROLE_ARN"),
  cleanupStateMachineArn: env("AWS_LABS_CLEANUP_STATE_MACHINE_ARN"),
  // Shown on the AWS "session expired" page.
  issuer: env("AWS_LABS_ISSUER", env("APP_PUBLIC_URL", "https://labs.example.com")),
  validatorRoleName: env("AWS_LABS_VALIDATOR_ROLE", "VlabValidatorRole"),
  validateMinIntervalSeconds: Number(env("AWS_LABS_VALIDATE_MIN_INTERVAL_SECONDS", "10")),
};

export const missingAwsLabsConfig = () => {
  const missing = [];
  if (!awsLabsInfra.schedulerRoleArn) missing.push("AWS_LABS_SCHEDULER_ROLE_ARN");
  if (!awsLabsInfra.cleanupStateMachineArn) missing.push("AWS_LABS_CLEANUP_STATE_MACHINE_ARN");
  return missing;
};

const REGION = awsLabsInfra.region;

const DEFAULT_LABS = {
  "aws-ec2": {
    title: "Amazon EC2",
    role: "VlabStudentEC2",
    consoleDestination: `https://${REGION}.console.aws.amazon.com/ec2/home?region=${REGION}#Home:`,
    durationMinutes: 60,
    maxExtensions: 1,
    extensionMinutes: 30,
    tasks: [
      { id: "ec2-keypair", title: "Create key pair lab-key" },
      { id: "ec2-sg", title: "Create security group web-sg allowing SSH (22) and HTTP (80)" },
      { id: "ec2-launch", title: "Launch a t2.micro or t3.micro instance tagged Name=web-server using lab-key and web-sg" },
      { id: "ec2-volume", title: "Create an 8 GiB gp3 volume and attach it to web-server" },
      { id: "ec2-stop", title: "Stop the web-server instance" },
    ],
  },
  "aws-s3": {
    title: "Amazon S3",
    role: "VlabStudentS3",
    consoleDestination: `https://s3.console.aws.amazon.com/s3/home?region=${REGION}`,
    durationMinutes: 45,
    maxExtensions: 1,
    extensionMinutes: 30,
    tasks: [
      { id: "s3-bucket", title: "Create bucket <bucketPrefix>-data in ap-south-1" },
      { id: "s3-upload", title: "Upload hello.txt" },
      { id: "s3-versioning", title: "Enable versioning and upload hello.txt again" },
      { id: "s3-lifecycle", title: "Add a lifecycle rule that moves objects to Glacier after 30 days" },
      { id: "s3-policy", title: "Add a bucket policy that denies non-HTTPS requests (aws:SecureTransport=false)" },
    ],
  },
  "aws-iam": {
    title: "AWS IAM",
    role: "VlabStudentIAM",
    consoleDestination: "https://console.aws.amazon.com/iam/home#/home",
    durationMinutes: 45,
    maxExtensions: 1,
    extensionMinutes: 30,
    instructions:
      "Every user and role you create must use the permissions boundary VlabStudentBoundary, or AWS will deny the create.",
    tasks: [
      { id: "iam-group", title: "Create group developers with AmazonS3ReadOnlyAccess attached" },
      { id: "iam-user", title: "Create user dev1 in developers with a console password" },
      { id: "iam-password-policy", title: "Set the account password policy: minimum length 12, require symbols" },
      { id: "iam-role", title: "Create role ec2-s3-reader trusted by ec2.amazonaws.com" },
      { id: "iam-custom-policy", title: "Create a customer policy allowing s3:ListBucket on one bucket and attach it to dev1" },
    ],
  },
};

// Content (durations, task titles) can be changed without a code change:
// AWS_LABS_CONFIG_JSON='{"aws-ec2":{"durationMinutes":90}}'
const overrides = (() => {
  try {
    return JSON.parse(env("AWS_LABS_CONFIG_JSON", "{}"));
  } catch {
    console.warn("[awsLabs] Ignoring invalid AWS_LABS_CONFIG_JSON");
    return {};
  }
})();

export const AWS_LABS = Object.fromEntries(
  Object.entries(DEFAULT_LABS).map(([id, lab]) => [id, { ...lab, ...(overrides[id] || {}) }]),
);

export const isAwsLabType = (labType) => Object.prototype.hasOwnProperty.call(AWS_LABS, labType);
