import 'dotenv/config';
import { ECSClient, DescribeTaskDefinitionCommand, ListTasksCommand, DescribeTasksCommand } from "@aws-sdk/client-ecs";

const client = new ECSClient({ region: process.env.AWS_REGION || "ap-south-1" });

async function run() {
  try {
    console.log("AWS_REGION:", process.env.AWS_REGION);
    console.log("ECS_CLUSTER:", process.env.ECS_CLUSTER);
    console.log("Listing task definitions or describing task definition 'vlab-dev-android-task'...");
    try {
      const taskDef = await client.send(new DescribeTaskDefinitionCommand({
        taskDefinition: "vlab-dev-android-task"
      }));
      console.log("Task Definition Container Definitions:");
      console.log(JSON.stringify(taskDef.taskDefinition.containerDefinitions, null, 2));
    } catch (e) {
      console.error("Failed to describe task definition:", e.message);
    }

    console.log("Listing tasks in cluster 'vlab-dev-cluster'...");
    try {
      const list = await client.send(new ListTasksCommand({
        cluster: "vlab-dev-cluster"
      }));
      console.log("Task ARNs:", list.taskArns);
      if (list.taskArns && list.taskArns.length > 0) {
        const desc = await client.send(new DescribeTasksCommand({
          cluster: "vlab-dev-cluster",
          tasks: list.taskArns
        }));
        console.log("Tasks details:", JSON.stringify(desc.tasks, null, 2));
      }
    } catch (e) {
      console.error("Failed to list/describe tasks:", e.message);
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

run();
