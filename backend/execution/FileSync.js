import fs from "fs";
import path from "path";
import { saveToContainer } from "../services/containerClient.js";

export class FileSync {
  static async syncFile(session, filePath, content) {
    if (!filePath) return;

    // 1. Sync file to active container if container is running
    if (session.status === "running") {
      try {
        await saveToContainer(session, { path: filePath, content });
        return;
      } catch (err) {
        console.warn(`[FileSync] Failed to write directly to container: ${err.message}`);
      }
    }

    // 2. Fallback: Write locally if running on local environment
    const cleanPath = filePath.replace(/^\/workspace\//, "").replace(/^\/+/, "");
    const localPath = path.join(path.resolve(process.cwd(), ".."), "workspace", cleanPath);
    try {
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, content, "utf-8");
    } catch (err) {
      console.warn(`[FileSync] Local write fallback failed: ${err.message}`);
    }
  }
}
