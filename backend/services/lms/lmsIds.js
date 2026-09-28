/** Numeric LMS identifiers only. Auth0 subjects such as auth0|xxxx are never parsed. */
export function numericLmsId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

export function cleanLmsId(value) {
  const numeric = numericLmsId(value);
  return numeric == null ? null : String(numeric);
}

export function endpointUrl(baseUrl, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(baseUrl || "").replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
