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

function hostFromUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).host;
  } catch {
    return raw.split("/")[0];
  }
}

/**
 * The SSO API is on experia.ignitolearn.com. The student portal is on {slug}.experia.ignitolearn.com.
 * Read the portal from the browser page, not from the API host.
 */
export function portalHostFromRequest(headers = {}, body = {}) {
  const candidates = [
    body?.portalHost,
    headers["x-tenant-domain"],
    headers["x-tenant-host"],
    hostFromUrl(headers.origin || headers.Origin),
    hostFromUrl(headers.referer || headers.Referer),
    headers.host,
    headers.Host,
  ];
  for (const candidate of candidates) {
    const host = String(candidate || "").trim();
    if (host && slugFromHost(host)) return host;
  }
  return String(candidates.find(Boolean) || "");
}

/** Build `{slug}.{apex}` from the browser host. Apex is taken from the request, never a fixed domain. */
export function portalHostForSlug(slug, requestHost) {
  const raw = String(requestHost || "").trim().toLowerCase();
  const hostname = raw.split(":")[0];
  const port = raw.includes(":") ? `:${raw.split(":").slice(1).join(":")}` : "";
  const cleanSlug = String(slug || "").trim().toLowerCase();
  if (!cleanSlug) return hostname ? `${hostname}${port}` : "";
  const current = slugFromHost(hostname);
  let apex = current ? hostname.slice(current.length + 1) : hostname;
  if (apex.startsWith("www.")) apex = apex.slice(4);
  if (!apex || apex === "localhost") return `${cleanSlug}.localhost${port}`;
  return `${cleanSlug}.${apex}${port}`;
}
