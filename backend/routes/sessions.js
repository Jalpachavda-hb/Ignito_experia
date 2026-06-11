import express from "express";
import {
  ECSClient,
  RunTaskCommand,
  DescribeTasksCommand,
  StopTaskCommand,
} from "@aws-sdk/client-ecs";
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from "@aws-sdk/client-ec2";
import { getLabById } from "../config/labs.js";
import { buildSessionTools, getSessionApiBaseUrl } from "../services/labTools.js";
import dotenv from "dotenv";
import { SESSIONS, clearSessionFiles } from "../services/sessionStore.js";
import crypto from "crypto";

dotenv.config();

const router = express.Router();

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const ec2Client = new EC2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const refreshSessionTools = (session) => {
  if (!session) return session;
  session.apiBaseUrl = getSessionApiBaseUrl(session);
  session.tools = buildSessionTools(session);
  return session;
};

// Helper: Get Public IP from ECS Task
async function getTaskPublicIp(taskArn) {
  try {
    console.log(`Searching Public IP for task: ${taskArn}`);
    const taskDetails = await ecsClient.send(
      new DescribeTasksCommand({
        cluster: process.env.ECS_CLUSTER,
        tasks: [taskArn],
      }),
    );

    const task = taskDetails.tasks[0];
    const attachment = task.attachments.find(
      (a) => a.type === "ElasticNetworkInterface",
    );
    if (!attachment) {
      console.warn("No ElasticNetworkInterface attachment found for task yet.");
      return null;
    }

    const eniId = attachment.details.find(
      (d) => d.name === "networkInterfaceId",
    )?.value;
    if (!eniId) {
      console.warn("No Network Interface ID found in attachment.");
      return null;
    }

    console.log(`Found ENI ID: ${eniId}. Fetching Public IP...`);
    const eniDetails = await ec2Client.send(
      new DescribeNetworkInterfacesCommand({
        NetworkInterfaceIds: [eniId],
      }),
    );

    const publicIp = eniDetails.NetworkInterfaces[0]?.Association?.PublicIp;
    if (publicIp) {
      console.log(`Successfully found Public IP: ${publicIp}`);
    } else {
      console.warn(`No Public IP associated with ENI ${eniId} yet.`);
    }
    return publicIp;
  } catch (error) {
    console.error("Error in getTaskPublicIp:", error);
    return null;
  }
}

// POST /api/lab-sessions
router.post("/", async (req, res) => {
  const { labId, userId } = req.body;
  console.log(`Starting lab session: labId=${labId}, userId=${userId}`);

  // Check if user already has an active session globally
  const existingSessionId = Object.keys(SESSIONS).find(
    (sid) =>
      SESSIONS[sid].userId === userId &&
      SESSIONS[sid].status !== "failed" &&
      SESSIONS[sid].status !== "stopped",
  );

  if (existingSessionId) {
    if (SESSIONS[existingSessionId].labId === labId) {
      console.log(
        `User ${userId} already has an active session for ${labId}: ${existingSessionId}`,
      );
      return res.json({
        success: true,
        ...refreshSessionTools(SESSIONS[existingSessionId]),
        message: "You already have an active lab session for this lab.",
      });
    } else {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active lab running. Please stop it to run this lab.",
      });
    }
  }

  const lab = getLabById(labId);

  if (!lab) {
    console.error(`Lab not found for ID: ${labId}`);
    return res.status(404).json({ success: false, message: "Lab not found" });
  }

  try {
    const sessionId = "sess_" + Math.random().toString(36).substr(2, 9);

    // Fallback if AWS is not configured
    if (!process.env.ECS_CLUSTER) {
      SESSIONS[sessionId] = {
        sessionId,
        labId,
        userId,
        status: "running",
        startedAt: new Date().toISOString(),
        message: "Lab environment (Mock) is ready",
      };
      refreshSessionTools(SESSIONS[sessionId]);
      return res.json({ success: true, ...SESSIONS[sessionId] });
    }

    console.log(`Requesting Fargate Task for ${lab.taskDefinition}...`);
    const taskParams = {
      cluster: process.env.ECS_CLUSTER,
      taskDefinition:
        lab.taskDefinition || process.env.ECS_TASK_DEFINITION_FAMILY,
      launchType: "FARGATE",
      enableExecuteCommand: true,
      networkConfiguration: {
        awsvpcConfiguration: {
          
          subnets: process.env.ECS_SUBNETS
            ? process.env.ECS_SUBNETS.split(",").map((s) => s.trim())
            : [],
          securityGroups: process.env.ECS_SECURITY_GROUPS
            ? process.env.ECS_SECURITY_GROUPS.split(",").map((s) => s.trim())
            : [],
          assignPublicIp: "ENABLED",
        },
      },
    };

    console.log("AWS RUN_TASK PARAMS:", JSON.stringify(taskParams, null, 2));
    const command = new RunTaskCommand(taskParams);

    const response = await ecsClient.send(command);

    if (!response.tasks || response.tasks.length === 0) {
      throw new Error("AWS ECS failed to return a task object.");
    }

    const taskArn = response.tasks[0].taskArn;
    console.log(`Fargate Task started successfully! TaskArn: ${taskArn}`);

    // Create session object
    SESSIONS[sessionId] = {
      sessionId,
      labId,
      userId,
      taskArn,
      status: "starting",
      message: `Provisioning ${lab.title} environment...`,
      estimatedReadyInSeconds: 45,
      expiresAt: new Date(Date.now() + 120 * 60 * 1000).toISOString(),
    };

    // Generate Jupyter token for data-science-lab (optional, used if token auth is enabled)
    if (labId === "data-science-lab") {
      SESSIONS[sessionId].jupyterToken = crypto.randomBytes(16).toString("hex");
    }

    res.json({ success: true, ...SESSIONS[sessionId] });
  } catch (error) {
    console.error("FARGATE START ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Failed to start lab environment",
      error: error.message,
    });
  }
});

// GET /api/lab-sessions/user/:userId
router.get("/user/:userId", (req, res) => {
  const { userId } = req.params;
  const { labId } = req.query;
  const sessionId = Object.keys(SESSIONS).find((sid) => {
    const s = SESSIONS[sid];
    return (
      s.userId === userId &&
      (s.status === "running" || s.status === "starting") &&
      (!labId || s.labId === labId)
    );
  });

  if (sessionId) {
    res.json({ success: true, session: refreshSessionTools(SESSIONS[sessionId]) });
  } else {
    res.json({ success: false, message: "No active session found" });
  }
});

// GET /api/lab-sessions/:id
router.get("/:id", async (req, res) => {
  const session = SESSIONS[req.params.id];
  if (!session) {
    return res
      .status(404)
      .json({ success: false, message: "Session not found" });
  }

  if (session.status === "starting" && session.taskArn) {
    try {
      const describeTasks = await ecsClient.send(
        new DescribeTasksCommand({
          cluster: process.env.ECS_CLUSTER,
          tasks: [session.taskArn],
        }),
      );

      const task = describeTasks.tasks[0];
      if (task.lastStatus === "RUNNING") {
        const publicIp = await getTaskPublicIp(session.taskArn);
        if (publicIp) {
          session.status = "running";
          session.startedAt = new Date().toISOString();
          session.message = "Lab environment is ready";
          session.publicIp = publicIp;
          refreshSessionTools(session);
        }
      } else if (task.lastStatus === "STOPPED") {
        session.status = "failed";
        session.message = `Lab environment failed to start. Reason: ${task.stoppedReason || "Container exited"}`;
      }
    } catch (error) {
      console.error("Status Poll Error:", error);
    }
  }

  res.json(refreshSessionTools(session));
});

// POST /api/lab-sessions/:id/stop
router.post("/:id/stop", async (req, res) => {
  const session = SESSIONS[req.params.id];
  if (!session) {
    return res
      .status(404)
      .json({ success: false, message: "Session not found" });
  }

  if (!session.taskArn) {
    clearSessionFiles(req.params.id);
    delete SESSIONS[req.params.id];
    console.log(`Aggressively cleared Mock Session: ${req.params.id}`);
    return res.json({
      success: true,
      sessionId: req.params.id,
      status: "stopped",
    });
  }

  try {
    await ecsClient.send(
      new StopTaskCommand({
        cluster: process.env.ECS_CLUSTER,
        task: session.taskArn,
        reason: "User requested stop",
      }),
    );

    clearSessionFiles(req.params.id);
    delete SESSIONS[req.params.id];
    console.log(`Aggressively cleared AWS Session: ${req.params.id}`);

    res.json({ success: true, sessionId: req.params.id, status: "stopped" });
  } catch (error) {
    console.error("Fargate Stop Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to stop environment" });
  }
});

export default router;
