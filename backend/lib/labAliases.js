// Retired or legacy lab IDs that must keep working for old bookmarks, saved
// sessions and course mappings.
// - dbms-lab pointed at vlab-dev-dbms-task, which the infrastructure never
//   created; it was split into mysql-lab / postgres-lab / oracle-lab.
// - postgres / oracle were the original codes of postgres-lab / oracle-lab.
const LAB_ID_ALIASES = {
  "dbms-lab": "mysql-lab",
  dbms: "mysql-lab",
  postgres: "postgres-lab",
  oracle: "oracle-lab",
};

export const resolveLabAlias = (labId) => {
  if (!labId) return labId;
  return LAB_ID_ALIASES[String(labId).toLowerCase().trim()] ?? labId;
};

// Legacy IDs that resolve to the given lab ID (e.g. "mysql-lab" -> ["dbms-lab", "dbms"]).
export const legacyIdsFor = (labId) => {
  const target = String(labId || "").toLowerCase().trim();
  return Object.keys(LAB_ID_ALIASES).filter((alias) => LAB_ID_ALIASES[alias] === target);
};
