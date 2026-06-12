import mysql from "mysql2/promise";
import { ENV } from "../config/env.js"; // Wait, I should check if ENV exists or use process.env directly.

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "ignito_experia",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const getDbConnection = async () => {
  return await pool.getConnection();
};

export const verifyDbConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("[MySQL] Connected successfully to the database.");
    connection.release();
    return true;
  } catch (error) {
    console.error("[MySQL] Failed to connect to the database:", error.message);
    return false;
  }
};

export default pool;
