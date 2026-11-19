import { getContainerHost, LAB_DESKTOP_PORT } from "../lib/labTools.js";

export class BrowserManager {
  // Full noVNC desktop URL, including the per-session VNC password.
  // Return it only to the session's owner; never log it.
  static getBrowserUrl(session) {
    const host = getContainerHost(session);
    if (!host || !session?.vncPassword) return null;
    const params = new URLSearchParams({ autoconnect: "1", resize: "scale", password: session.vncPassword });
    return `http://${host}:${LAB_DESKTOP_PORT}/vnc.html?${params.toString()}`;
  }
}
