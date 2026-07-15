import net from "net";
import crypto from "crypto";
import { getSession } from "./services/sessionRepository.js";
import { getContainerPort } from "./lib/labTools.js";

const activeConnections = new Map();

/**
 * Encodes a text payload into a standard WebSocket text frame (RFC 6455).
 */
const encodeWsFrame = (text) => {
  const buf = Buffer.from(text, "utf8");
  const len = buf.length;
  let header;

  if (len <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + Opcode 1 (text)
    header[1] = len;  // No mask
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }

  return Buffer.concat([header, buf]);
};

/**
 * Decodes standard WebSocket frames from a buffer.
 */
const decodeWsFrames = (buffer, onMessage) => {
  let offset = 0;
  while (offset < buffer.length) {
    if (buffer.length - offset < 2) break;

    const byte1 = buffer[offset];
    const byte2 = buffer[offset + 1];
    offset += 2;

    const opcode = byte1 & 0x0f;
    const isMasked = (byte2 & 0x80) !== 0;
    let payloadLen = byte2 & 0x7f;

    if (payloadLen === 126) {
      if (buffer.length - offset < 2) break;
      payloadLen = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLen === 127) {
      if (buffer.length - offset < 8) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskingKey;
    if (isMasked) {
      if (buffer.length - offset < 4) break;
      maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
    }

    if (buffer.length - offset < payloadLen) break;
    const payload = buffer.slice(offset, offset + payloadLen);
    offset += payloadLen;

    if (isMasked && maskingKey) {
      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }
    }

    if (opcode === 1 || opcode === 2) { // Text or Binary frame
      onMessage(payload.toString("utf8"));
    }
  }
};

export const setupTerminal = (io) => {
  io.on("connection", async (socket) => {
    console.log("[Terminal] Client connected:", socket.id);

    const sessionId = socket.handshake.query.sessionId;
    if (!sessionId) {
      socket.emit("terminal-output", "\r\n\x1b[31m[ERROR: Session ID required]\x1b[0m\r\n");
      socket.disconnect();
      return;
    }

    let session;
    try {
      session = await getSession(sessionId);
    } catch (err) {
      console.error("[Terminal] Failed to retrieve session:", err.message);
    }

    if (!session || session.status !== "running" || !session.taskPrivateIp) {
      socket.emit("terminal-status", { status: "error", message: "Container not running" });
      socket.emit("terminal-output", "\r\n\x1b[31m[ERROR: Lab container is not running or unreachable]\x1b[0m\r\n");
      return;
    }

    const host = session.taskPrivateIp;
    const port = (await getContainerPort(session.labId)) || session.containerPort || 8080;

    console.log(`[Terminal] Connecting to private container terminal service at ws://${host}:${port}/terminal`);
    socket.emit("terminal-status", { status: "connecting", message: "Connecting to container terminal..." });

    // Establish raw TCP socket to container runtime and trigger WebSocket handshake
    const wsKey = crypto.randomBytes(16).toString("base64");
    let isHandshakeComplete = false;
    let receiveBuffer = Buffer.alloc(0);

    const containerSocket = net.connect(port, host, () => {
      const handshake = [
        "GET /terminal HTTP/1.1",
        `Host: ${host}:${port}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${wsKey}`,
        "Sec-WebSocket-Version: 13",
        "\r\n"
      ].join("\r\n");
      containerSocket.write(handshake);
    });

    activeConnections.set(socket.id, containerSocket);

    containerSocket.on("data", (data) => {
      if (!isHandshakeComplete) {
        receiveBuffer = Buffer.concat([receiveBuffer, data]);
        const responseStr = receiveBuffer.toString("utf8");
        if (responseStr.includes("\r\n\r\n")) {
          if (responseStr.startsWith("HTTP/1.1 101")) {
            console.log("[Terminal] WebSocket handshake completed with container.");
            isHandshakeComplete = true;
            socket.emit("terminal-status", { status: "ready", message: "Terminal Connected" });

            // Process any trailing data in the buffer after handshake response
            const headLength = responseStr.indexOf("\r\n\r\n") + 4;
            if (receiveBuffer.length > headLength) {
              const trailing = receiveBuffer.slice(headLength);
              decodeWsFrames(trailing, (msg) => socket.emit("terminal-output", msg));
            }
          } else {
            console.error("[Terminal] Failed to handshake. Response:", responseStr);
            socket.emit("terminal-output", "\r\n\x1b[31m[ERROR: Failed to establish container shell connection]\x1b[0m\r\n");
            containerSocket.end();
          }
          receiveBuffer = Buffer.alloc(0);
        }
      } else {
        // Handshake complete, parse incoming WebSocket frames
        decodeWsFrames(data, (msg) => {
          socket.emit("terminal-output", msg);
        });
      }
    });

    containerSocket.on("error", (err) => {
      console.error("[Terminal] Container socket error:", err.message);
      socket.emit("terminal-output", `\r\n\x1b[31m[Container Connection Error: ${err.message}]\x1b[0m\r\n`);
    });

    containerSocket.on("close", () => {
      console.log("[Terminal] Container socket closed for client:", socket.id);
      socket.emit("terminal-output", "\r\n[Terminal session disconnected]\r\n");
      activeConnections.delete(socket.id);
    });

    // Handle terminal input from student's browser
    socket.on("terminal-input", (data) => {
      if (containerSocket.writable && isHandshakeComplete) {
        try {
          containerSocket.write(encodeWsFrame(data));
        } catch (err) {
          console.error("[Terminal] Write failed:", err.message);
        }
      }
    });

    // Handle resize events from student's browser
    socket.on("terminal-resize", ({ cols, rows }) => {
      if (containerSocket.writable && isHandshakeComplete) {
        try {
          const resizePayload = JSON.stringify({ event: "resize", cols, rows });
          containerSocket.write(encodeWsFrame(resizePayload));
        } catch (err) {
          console.warn("[Terminal] Resize broadcast failed:", err.message);
        }
      }
    });

    // Handle run-file commands from editor
    socket.on("terminal-run-file", ({ path: filePath, content, language }) => {
      if (containerSocket.writable && isHandshakeComplete) {
        try {
          const runPayload = JSON.stringify({ event: "run-file", path: filePath, content, language });
          containerSocket.write(encodeWsFrame(runPayload));
        } catch (err) {
          console.error("[Terminal] Run-file trigger failed:", err.message);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("[Terminal] Client disconnected:", socket.id);
      const conn = activeConnections.get(socket.id);
      if (conn) {
        conn.end();
        activeConnections.delete(socket.id);
      }
    });
  });
};
