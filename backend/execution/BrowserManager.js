import { getContainerHost } from "../lib/labTools.js";

export class BrowserManager {
  static getBrowserUrl(session) {
    const host = getContainerHost(session) || "localhost";
    return `http://${host}:6080/vnc.html?autoconnect=true&resize=scale`;
  }
}
