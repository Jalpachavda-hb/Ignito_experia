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
