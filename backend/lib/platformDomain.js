/**
 * Platform apex domains.
 *
 * BASE_DOMAIN is the live apex (default ignitoexperia.com). University portals live on
 * {slug}.{BASE_DOMAIN}. LEGACY_BASE_DOMAINS (comma separated) lists older apexes that still
 * have to work while DNS and bookmarks move over (default experia.ignitolearn.com).
 */
import "../config/env.js"; // loads backend/.env before BASE_DOMAIN is read

const clean =(value) => String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");

export const BASE_DOMAIN = clean(process.env.BASE_DOMAIN) || "ignitoexperia.com";

export const LEGACY_BASE_DOMAINS = String(process.env.LEGACY_BASE_DOMAINS ?? "experia.ignitolearn.com")
  .split(",")
  .map(clean)
  .filter((d) => d && d !== BASE_DOMAIN);

export const PLATFORM_DOMAINS = [BASE_DOMAIN, ...LEGACY_BASE_DOMAINS];

export function hostnameOf(host) {
  return String(host || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
}

/** The platform apex this host belongs to ("" when it is not a platform host). */
export function platformApexFor(host) {
  const hostname = hostnameOf(host);
  if (!hostname) return "";
  return PLATFORM_DOMAINS.find((apex) => hostname === apex || hostname.endsWith(`.${apex}`)) || "";
}

/** True for the main site itself (apex or www.apex), where no university slug applies. */
export function isPlatformMainHost(host) {
  const hostname = hostnameOf(host);
  return PLATFORM_DOMAINS.some((apex) => hostname === apex || hostname === `www.${apex}`);
}
