import express from 'express';
import { 
  ECSClient, 
  ListTasksCommand, 
  DescribeTasksCommand,
  RunTaskCommand 
} from "@aws-sdk/client-ecs";
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

const ecsClient = new ECSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const CATALOG = {
  regions: [
    { id: "ap-south-1", name: "Asia Pacific (Mumbai)", code: "ap-south-1" }
  ],
  images: [
    { id: "vlab-base", name: "Standard VLab Environment", badge: "Fargate" }
  ],
  plans: [
    { id: "fargate-1", price: "$0.04/hr", ram: "0.5 GB", cpu: "0.25 vCPU" },
    { id: "fargate-2", price: "$0.09/hr", ram: "2 GB", cpu: "1 vCPU" },
    { id: "fargate-3", price: "$0.18/hr", ram: "4 GB", cpu: "2 vCPU" }
  ]
};

// GET /api/compute/instances
router.get('/instances', async (req, res) => {
  try {
    const listTasks = await ecsClient.send(new ListTasksCommand({
      cluster: process.env.ECS_CLUSTER,
    }));

    if (!listTasks.taskArns || listTasks.taskArns.length === 0) {
      return res.json([]);
    }

    const describeTasks = await ecsClient.send(new DescribeTasksCommand({
      cluster: process.env.ECS_CLUSTER,
      tasks: listTasks.taskArns,
    }));

    const tasks = describeTasks.tasks.map(t => ({
      id: t.taskArn.split('/').pop(),
      name: t.taskDefinitionArn.split('/').pop().split(':')[0],
      status: t.lastStatus,
      type: 'Fargate',
      region: process.env.AWS_REGION,
      createdAt: t.createdAt
    }));

    res.json(tasks);
  } catch (error) {
    console.error("Error listing Fargate tasks:", error);
    res.status(500).json({ success: false, message: "Failed to fetch compute resources" });
  }
});

// GET /api/compute/catalog
router.get('/catalog', (req, res) => {
  res.json(CATALOG);
});

// POST /api/compute/instances
router.post('/instances', async (req, res) => {
  const { taskDefinition } = req.body;
  
  try {
    const command = new RunTaskCommand({
      cluster: process.env.ECS_CLUSTER,
      taskDefinition: taskDefinition || process.env.ECS_TASK_DEFINITION_FAMILY,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: process.env.ECS_SUBNETS
            ? process.env.ECS_SUBNETS.split(',').map((s) => s.trim())
            : [],
          securityGroups: process.env.ECS_SECURITY_GROUPS
            ? process.env.ECS_SECURITY_GROUPS.split(',').map((s) => s.trim())
            : [],
          assignPublicIp: "ENABLED",
        },
      },
    });

    const response = await ecsClient.send(command);
    const task = response.tasks[0];

    res.json({ 
      success: true, 
      instanceId: task.taskArn.split('/').pop(),
      status: 'Pending',
      message: 'Fargate task provisioning started'
    });
  } catch (error) {
    console.error("Error starting Fargate task:", error);
    res.status(500).json({ success: false, message: "Failed to provision compute resource" });
  }
});

export default router;
