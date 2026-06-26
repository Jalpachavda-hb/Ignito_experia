import pool from "./lib/mysql.js";
import fs from "fs";

async function run() {
  try {
    const [rows] = await pool.query("SELECT UserId, FullName, Email, Role, Status FROM Users");
    fs.writeFileSync("scratch_out.txt", JSON.stringify(rows, null, 2));
    console.log("SUCCESS SELECT USERS:", rows.length);
    process.exit(0);
  } catch (err) {
    fs.writeFileSync("scratch_out.txt", "ERROR:\n" + (err.stack || err.message));
    console.error("SELECT USERS ERROR:", err.message);
    process.exit(1);
  }
}
run();
