const RESERVED = new Set(["www", "localhost", "experia"]);

export function isIpHost(hostname) {
  if (!hostname) return false;
  if (hostname.includes(":")) return true;
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

export function slugFromHost(host) {
  const hostname = String(host || "").split(":")[0].trim().toLowerCase();
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    isIpHost(hostname) ||
    hostname === "experia.ignitolearn.com" ||
    hostname === "www.experia.ignitolearn.com"
  ) {
    return "";
  }
  const parts = hostname.split(".");
  if (parts.length > 1 && !RESERVED.has(parts[0])) return parts[0];
  return "";
}
