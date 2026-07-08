const LAB_ID_TO_TYPE = {
  "python-lab": "python",
  "java-lab": "java",
  "linux-lab": "linux",
  "dbms-lab": "dbms",
  "datascience-lab": "datascience",
  "bigdata-lab": "bigdata",
  "testing-lab": "testing",
  "agile-lab": "agilemethodology",
  "mobile-app-lab": "android",
  "dotnet-lab": "dotnet",
  "software-eng-lab": "softwareengeering",
};

const LANGUAGE_TO_TYPE = {
  python: "python",
  java: "java",
  csharp: "dotnet",
  "c#": "dotnet",
  cs: "dotnet",
  shell: "linux",
  bash: "linux",
  sql: "dbms",
};

export const canonicalLabType = (labId) => {
  if (!labId) return labId;
  if (LAB_ID_TO_TYPE[labId]) return LAB_ID_TO_TYPE[labId];
  if (labId.endsWith("-lab")) return labId.replace("-lab", "");
  return labId;
};

export const resolveLabType = ({ labId, language, labType }) => {
  if (labType) return labType.toLowerCase();
  if (language && LANGUAGE_TO_TYPE[language]) return LANGUAGE_TO_TYPE[language];
  if (labId) return canonicalLabType(labId);
  return language?.toLowerCase() || "python";
};

export const getAllowedExtensions = (labId) => {
  const id = (labId || "").toLowerCase();
  if (id.includes("agile")) {
    return ["java"];
  }
  if (
    id.includes("big-data") ||
    id.includes("bigdata") ||
    id.includes("analytics") ||
    id.includes("hadoop")
  ) {
    return ["py", "java", "csv", "txt", "jar", "xml", "sh", "json", "log", "parquet", "avro", "orc"];
  }
  if (id.includes("mobile") || id.includes("android") || id.includes("mobile-app-lab")) {
    return ["java", "kt", "xml", "gradle", "properties", "sh", "json", "png", "jpg", "jpeg", "pro"];
  }
  if (id.includes("java-development") || id.includes("java")) {
    return ["java"];
  }
  if (id.includes("python")) {
    return ["py"];
  }
  if (id.includes("dotnet") || id.includes("csharp") || id.includes("c#")) {
    return ["cs", "cshtml", "razor", "json", "xml", "csproj", "sln", "css", "js", "html", "txt", "config", "props"];
  }
  return ["py", "java", "js", "jsx", "html", "css", "json", "md", "csv", "txt", "log", "xml", "parquet", "avro", "orc", "sh", "jar"];
};
