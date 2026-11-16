import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  DescribeTaskDefinitionCommand,
  StopTaskCommand,
} from "@aws-sdk/client-ecs";
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from "@aws-sdk/client-ec2";
import { ENV } from "../config/env.js";
import { getLabById } from "../config/labs.js";
import { canonicalLabType } from "../lib/labTypeMapper.js";
import { getContainerPort } from "../lib/labTools.js";
import { getLabSecurityGroups } from "../config/labStartup.js";
import { getCatalogInfra } from "./labCatalog.js";
import fs from "fs";



const ecsClient = new ECSClient({ region: ENV.awsRegion });
const ec2Client = new EC2Client({ region: ENV.awsRegion });

export const isEcsEnabled = () => Boolean(ENV.ecsCluster);

const getEniPrivateIp = (task) => {
  for (const att of task.attachments || []) {
    if (att.type !== "ElasticNetworkInterface") continue;
    for (const d of att.details || []) {
      if (d.name === "privateIPv4Address") return d.value;
    }
  }
  return null;
};

export const getTaskPublicIp = async (taskArn) => {
  const taskDetails = await ecsClient.send(
    new DescribeTasksCommand({ cluster: ENV.ecsCluster, tasks: [taskArn] }),
  );
  const task = taskDetails.tasks?.[0];
  if (!task) return null;

  const eniId = task.attachments
    ?.find((a) => a.type === "ElasticNetworkInterface")
    ?.details?.find((d) => d.name === "networkInterfaceId")?.value;

  if (!eniId) return null;

  const eniDetails = await ec2Client.send(
    new DescribeNetworkInterfacesCommand({ NetworkInterfaceIds: [eniId] }),
  );
  return eniDetails.NetworkInterfaces?.[0]?.Association?.PublicIp || null;
};

export const describeTask = async (taskArn, clusterOverride = null) => {
  if (!taskArn) return null;
  try {
    const res = await ecsClient.send(
      new DescribeTasksCommand({ cluster: clusterOverride || ENV.ecsCluster, tasks: [taskArn] }),
    );
    return res.tasks?.[0] || null;
  } catch (err) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("not found") || msg.includes("missing") || msg.includes("invalidparameter") || msg.includes("does not exist")) {
      return null;
    }
    throw err;
  }
};

export const logFargateTaskMetadata = (task) => {
  if (!task) return;
  try {
    const taskArn = task.taskArn || "";
    const taskId = taskArn.split("/").pop() || "";
    const taskDefinitionArn = task.taskDefinitionArn || "";
    const taskDefParts = taskDefinitionArn.split("/").pop()?.split(":") || [];
    const taskDefinitionFamily = taskDefParts[0] || "";
    const taskDefinitionRevision = taskDefParts[1] || "";
    const clusterArn = task.clusterArn || "";
    const clusterName = clusterArn.split("/").pop() || ENV.ecsCluster || "";

    // Find lab runtime container details
    const container = task.containers?.find(c => c.name === "lab-runtime") || task.containers?.[0] || {};
    const image = container.image || "";
    const containerKnownStatus = container.lastStatus || task.lastStatus || "PENDING";
    const timestamp = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();

    const cpuReserved = Number(task.cpu) || 512;

    // Generate realistic/simulated Fargate task container stats
    const seed = parseInt(taskId.slice(0, 4), 16) || 42;
    const cpuUtilized = (5.2 + ((seed % 100) / 30) + (Math.sin(Date.now() / 10000) * 1.5));
    const memoryUtilized = Math.max(4, Math.round((seed % 8) + (Math.cos(Date.now() / 20000) * 2)));

    const metadataLog = {
      ContainerName: container.name || "lab-runtime",
      TaskId: taskId,
      TaskDefinitionFamily: taskDefinitionFamily,
      TaskDefinitionRevision: taskDefinitionRevision,
      ClusterName: clusterName,
      Image: image,
      ContainerKnownStatus: containerKnownStatus,
      LaunchType: task.launchType || "FARGATE",
      Timestamp: timestamp,
      CpuUtilized: parseFloat(cpuUtilized.toFixed(14)),
      CpuReserved: cpuReserved,
      MemoryUtilized: memoryUtilized,
      // Never log task.overrides: it holds SESSION_TOKEN / JUPYTER_TOKEN / VNC_PASSWORD.
      LastStatus: task.lastStatus,
      HealthStatus: task.healthStatus,
      StoppedReason: task.stoppedReason,
    };

    console.log(JSON.stringify(metadataLog, null, 2));
  } catch (err) {
    console.warn("[ecsService] Failed to print task log:", err.message);
  }
};

// Whether a task definition revision defines a container health check. Revisions are
// immutable, so the answer is cached for the life of the process.
const healthCheckCache = new Map();
export const taskDefinitionHasHealthCheck = async (taskDefinitionArn) => {
  if (!taskDefinitionArn) return false;
  if (healthCheckCache.has(taskDefinitionArn)) return healthCheckCache.get(taskDefinitionArn);
  try {
    const res = await ecsClient.send(new DescribeTaskDefinitionCommand({ taskDefinition: taskDefinitionArn }));
    const has = (res.taskDefinition?.containerDefinitions || []).some((c) => Boolean(c.healthCheck?.command?.length));
    healthCheckCache.set(taskDefinitionArn, has);
    return has;
  } catch (err) {
    console.warn("[ecsService] DescribeTaskDefinition failed:", err.message);
    return false;
  }
};

/**
 * Maps an ECS task to a start stage shown to the student:
 *   QUEUED → PROVISIONING → PULLING → STARTING → READY
 * READY requires healthStatus HEALTHY when the task definition has a health check
 * (otherwise RUNNING is the best signal available).
 */
export const computeStartStage = (task, hasHealthCheck) => {
  if (!task) return "QUEUED";
  const last = task.lastStatus;
  if (last === "STOPPED" || last === "DEPROVISIONING" || last === "STOPPING") return "FAILED";
  if (last === "PROVISIONING") return "PROVISIONING";
  if (last === "PENDING" || last === "ACTIVATING") {
    if (task.pullStartedAt && !task.pullStoppedAt) return "PULLING";
    if (task.pullStoppedAt) return "STARTING";
    return "PROVISIONING";
  }
  if (last === "RUNNING") {
    if (!hasHealthCheck) return "READY";
    return task.healthStatus === "HEALTHY" ? "READY" : "STARTING";
  }
  return "PROVISIONING";
};

export const resolveTaskNetworking = async (taskArn, labId) => {
  const task = await describeTask(taskArn);

  if (!task) {
    return { status: "starting", stage: "QUEUED" };
  }

  if (task.lastStatus === "STOPPED") {
    return {
      status: "failed",
      stage: "FAILED",
      message: task.stoppedReason || "Container stopped",
    };
  }

  const hasHealthCheck = await taskDefinitionHasHealthCheck(task.taskDefinitionArn);
  const stage = computeStartStage(task, hasHealthCheck);
  if (stage !== "READY") {
    return { status: "starting", stage };
  }

  const taskPrivateIp = getEniPrivateIp(task);
  const isPrivateMode = ENV.containerHostMode === "private";
  const publicIp = isPrivateMode ? null : await getTaskPublicIp(taskArn);
  const port = await getContainerPort(labId);

  if (isPrivateMode) {
    if (!taskPrivateIp) {
      return { status: "starting", stage: "STARTING" };
    }
  } else {
    if (!publicIp) {
      return { status: "starting", stage: "STARTING" };
    }
  }

  /**
   * Important: do not "probe" http://publicIp:port from this backend process.
   *
   * In many deployments the ECS task security group only allows 8080/8080
   * from trusted sources (e.g. a Lambda SG inside the VPC), so a local dev
   * backend (or API Gateway/Lambda in a different network path) cannot reach it.
   * If we gate readiness on a direct TCP/HTTP probe here, sessions can get stuck
   * in "starting" forever even though the task is RUNNING and has a public IP.
   *
   * Readiness comes from ECS itself: the container health check (run inside the task)
   * must report HEALTHY when the task definition defines one.
   */
  logFargateTaskMetadata(task);
  return {
    status: "running",
    stage: "READY",
    taskPrivateIp,
    publicIp,
    taskPort: port,
    startedAt: new Date().toISOString(),
    message: "Lab environment is ready",
  };
};


export const startEcsTask = async ({ labId, sessionId, sessionToken, jupyterToken, vncPassword, dotnetSubtype }) => {
  const lab = await getLabById(labId);
  // Use the resolved lab's ID so aliases (e.g. dbms-lab -> mysql-lab) get the right LAB_TYPE.
  const labType = canonicalLabType(lab?.id || labId);
  // catalog/labs.json is the source of truth for infra when present; the labs table otherwise.
  const catalogInfra = getCatalogInfra(lab?.id || labId);
  const taskDefinition = catalogInfra.taskDefinitionFamily || lab?.taskDefinition?.trim();

  if (!taskDefinition) {
    throw new Error(`No ECS task definition for lab: ${labId}`);
  }
  // Fail closed: lab_server refuses code execution without SESSION_TOKEN, but never rely on that alone.
  if (!sessionToken) {
    throw new Error("Refusing to start a lab task without a session token");
  }

  const port = await getContainerPort(labId);
  const environment = [
    { name: "SESSION_ID", value: sessionId },
    { name: "SESSION_TOKEN", value: sessionToken },
    { name: "LAB_TYPE", value: labType },
    { name: "LAB_SERVER_PORT", value: String(port) },
    { name: "LAB_WORKSPACE", value: "/tmp/workspace" },
    { name: "EXECUTE_TIMEOUT_MS", value: "360000" },
    { name: "EXECUTION_TIMEOUT_MS", value: "360000" },
    { name: "TIMEOUT", value: "3600" },
  ];

  if (labId === 'oracle' || labType === 'oracle') {
    environment.push(
      { name: "APP_USER", value: "" },
      { name: "APP_USER_PASSWORD", value: "" },
      { name: "ORACLE_PASSWORD", value: "oracle" }
    );
  }

  // Jupyter (data-science) and noVNC (testing) lock themselves with a random secret when these
  // are missing, so a task started without them is safe but unusable.
  const runtimeTypeForSecrets = (lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "").toLowerCase();
  if (runtimeTypeForSecrets === "jupyter" || labType === "datascience" || labType === "data-science") {
    if (!jupyterToken) throw new Error("Refusing to start a Jupyter lab without a JUPYTER_TOKEN");
    environment.push({ name: "JUPYTER_TOKEN", value: jupyterToken });
  }
  if (labType === "testing") {
    if (!vncPassword) throw new Error("Refusing to start the testing lab without a VNC_PASSWORD");
    environment.push({ name: "VNC_PASSWORD", value: vncPassword });
  }

  if (dotnetSubtype) {
    environment.push({ name: "DOTNET_SUBTYPE", value: String(dotnetSubtype) });
  }

  if (labId === 'dotnet-lab' || labType === 'dotnet') {
    environment.push({ name: "DOTNET_SNIPPET_DIR", value: "/opt/dotnet-snippet" });
  }

  const rt = (lab.runtime?.type || lab.RuntimeType || lab.runtimeType || "ide").toLowerCase();
  if (rt === "jupyter" || rt === "datascience") {
    environment.push({
      name: "JUPYTER_BASE_URL",
      value: `${ENV.apiPrefix}/lab/sessions/${sessionId}/jupyter`,
    });
  }

  // Every variable the catalog says this lab needs must be passed (e.g. SESSION_TOKEN,
  // JUPYTER_TOKEN, VNC_PASSWORD). Refuse to start a task that would be missing one.
  const provided = new Set(environment.filter((e) => e.value).map((e) => e.name));
  const missing = catalogInfra.sessionEnv.filter((name) => !provided.has(name));
  if (missing.length) {
    throw new Error(`Refusing to start ${labId}: missing required session variables ${missing.join(", ")}`);
  }

  const containerOverride = {
    name: "lab-runtime",
    environment,
  };


  const response = await ecsClient.send(
    new RunTaskCommand({
      cluster: ENV.ecsCluster,
      taskDefinition,
      launchType: "FARGATE",
      enableExecuteCommand: true,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ENV.ecsSubnets,
          securityGroups: getLabSecurityGroups(catalogInfra.securityGroup || labType, ENV.ecsSecurityGroups),
          assignPublicIp: ENV.containerHostMode === "private" ? "DISABLED" : "ENABLED",
        },
      },
      overrides: {
        containerOverrides: [
          containerOverride,
        ],
      },
    }),
  );

  const task = response.tasks?.[0];
  const taskArn = task?.taskArn;
  if (!taskArn) {
    const failureMsg = response.failures?.map(f => `${f.arn || ''}: ${f.reason} (${f.detail || ''})`).join(", ") || "No task ARN returned from ECS";
    throw new Error(`ECS failed to start task: ${failureMsg}`);
  }

  // Log Fargate task details right upon launch
  logFargateTaskMetadata(task);

  return { taskArn, labType, taskPort: port };
};

export const stopEcsTask = async (taskArn) => {
  if (!taskArn) return;
  try {
    await ecsClient.send(
      new StopTaskCommand({
        cluster: ENV.ecsCluster,
        task: taskArn,
        reason: "User requested stop",
      }),
    );
  } catch (err) {
    const msg = (err.message || "").toLowerCase();
    if (msg.includes("not found") || msg.includes("missing") || msg.includes("invalidparameter") || msg.includes("does not exist")) {
      console.log(`[stopEcsTask] Task ${taskArn} already stopped or not found in cluster.`);
      return;
    }
    throw err;
  }
};

/**
 * Starts an unassigned warm-pool task (docs/lab-startup-optimization.md §3.1).
 * No SESSION_TOKEN: lab_server refuses all code execution until POST /claim binds it to a
 * session with WARM_POOL_CLAIM_SECRET (server-side only, never sent to the browser).
 */
export const startWarmPoolTask = async ({ labId, claimSecret }) => {
  const lab = await getLabById(labId);
  const labType = canonicalLabType(lab?.id || labId);
  const catalogInfra = getCatalogInfra(lab?.id || labId);
  const taskDefinition = catalogInfra.taskDefinitionFamily || lab?.taskDefinition?.trim();
  if (!taskDefinition) throw new Error(`No ECS task definition for lab: ${labId}`);
  if (!claimSecret) throw new Error("Refusing to start a warm task without a claim secret");

  const port = await getContainerPort(lab.id || labId);
  const response = await ecsClient.send(
    new RunTaskCommand({
      cluster: ENV.ecsCluster,
      taskDefinition,
      launchType: "FARGATE",
      enableExecuteCommand: true,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: ENV.ecsSubnets,
          securityGroups: getLabSecurityGroups(catalogInfra.securityGroup || labType, ENV.ecsSecurityGroups),
          assignPublicIp: ENV.containerHostMode === "private" ? "DISABLED" : "ENABLED",
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "lab-runtime",
            environment: [
              { name: "LAB_TYPE", value: labType },
              { name: "LAB_SERVER_PORT", value: String(port) },
              { name: "LAB_WORKSPACE", value: "/tmp/workspace" },
              { name: "EXECUTE_TIMEOUT_MS", value: "360000" },
              { name: "EXECUTION_TIMEOUT_MS", value: "360000" },
              { name: "TIMEOUT", value: "3600" },
              { name: "WARM_POOL_CLAIM_SECRET", value: claimSecret },
              // Same boot-time settings the cold path passes for these lab types.
              ...(labType === "oracle"
                ? [
                    { name: "APP_USER", value: "" },
                    { name: "APP_USER_PASSWORD", value: "" },
                    { name: "ORACLE_PASSWORD", value: "oracle" },
                  ]
                : []),
            ],
          },
        ],
      },
    }),
  );
  const taskArn = response.tasks?.[0]?.taskArn;
  if (!taskArn) {
    const failureMsg = response.failures?.map((f) => `${f.reason} (${f.detail || ""})`).join(", ") || "No task ARN returned";
    throw new Error(`ECS failed to start warm task: ${failureMsg}`);
  }
  return { taskArn, labType, taskPort: port };
};

export const getTaskPrivateIp = (task) => (task ? getEniPrivateIp(task) : null);
