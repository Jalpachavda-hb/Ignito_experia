import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".png";
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export const uploadMiddleware = upload.single("file");

export function uploadFileHandler(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    // Mirror uploaded file to vlab backend uploads directory if it exists
    try {
      const vlabUploadsDir = path.resolve(__dirname, "../../../backend/uploads");
      if (fs.existsSync(path.dirname(vlabUploadsDir))) {
        if (!fs.existsSync(vlabUploadsDir)) {
          fs.mkdirSync(vlabUploadsDir, { recursive: true });
        }
        fs.copyFileSync(req.file.path, path.join(vlabUploadsDir, req.file.filename));
      }
    } catch (copyErr) {
      console.warn("Could not copy uploaded image to backend/uploads:", copyErr.message);
    }

    const host = req.get("host") || "localhost:4000";
    const forwardedProto = req.headers["x-forwarded-proto"];
    const isLocal = host.includes("localhost") || host.includes("127.0.0.1");
    const isHttps = forwardedProto === "https" || req.protocol === "https" || req.secure || (!isLocal && !host.startsWith("192.168."));
    const protocol = isHttps ? "https" : "http";

    // Determine upload path prefix
    let prefix = "/uploads";
    if (req.originalUrl && req.originalUrl.includes("/owner-api")) {
      prefix = "/owner-api/uploads";
    } else if (host.includes("experia.ignitolearn.com")) {
      prefix = "/owner-api/uploads";
    }

    const fileUrl = `${protocol}://${host}${prefix}/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      url: fileUrl,
      relativeUrl: `/uploads/${req.file.filename}`,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return res.status(500).json({ success: false, message: "Failed to upload image", error: error.message });
  }
}
