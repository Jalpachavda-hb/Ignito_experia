import dotenv from "dotenv";
dotenv.config();
import pool from "../lib/mysql.js";

async function main() {
  try {
    const [rows] = await pool.query("SELECT LabId, LabCode, Title, RuntimeType, RuntimePort, ContainerApiEnabled, ContainerApiPort, TaskDefinition FROM Labs");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

main();
