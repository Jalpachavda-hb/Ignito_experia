/** One key per lab so a purchase, the course card, and session start share the same wallet. */
export function canonicalLabKey(labId, hint = "") {
  const blob = `${labId || ""} ${hint || ""}`.toLowerCase();
  if (
    blob.includes("4011") ||
    blob.includes("dotnet") ||
    blob.includes(".net") ||
    blob.includes("c#") ||
    blob.includes("programming with c") ||
    blob.includes("web technology")
  ) {
    return "dotnet";
  }
  if (
    blob.includes("4031") ||
    blob.includes("dbms") ||
    blob.includes("sql") ||
    blob.includes("relational database") ||
    blob.includes("database management")
  ) {
    return "dbms";
  }
  if (blob.includes("python")) return "python";
  if (blob.includes("java") && !blob.includes("javascript")) return "java";
  if (blob.includes("linux")) return "linux";
  if (blob.includes("android") || blob.includes("mobile")) return "android";
  if (blob.includes("data science") || blob.includes("data-science")) return "data-science";
  if (blob.includes("big data") || blob.includes("big-data")) return "big-data";
  if (blob.includes("testing")) return "testing";
  if (blob.includes("agile")) return "agile";
  if (blob.includes("software eng") || blob.includes("software-eng")) return "software-eng";

  return String(labId || "")
    .toLowerCase()
    .trim()
    .replace(/^lab-/, "")
    .replace(/-lab$/, "");
}
