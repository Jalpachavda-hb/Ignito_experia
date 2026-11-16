// Lab catalog: levels, topics and lab metadata (docs/lab-catalog.md).
//
// catalog/labs.json (from the infra repo) is the source of truth for what each lab is. Copy it to
// backend/catalog/labs.json at build/deploy time, or point LAB_CATALOG_PATH at it. Presentation
// fields (logo, credits, semester, ...) stay in the labs table and are joined on `id`.
//
// Without the file, every lab still gets a `level` derived from its `complexity`, and the
// catalog-only fields (topics, notCovered, prerequisites, ...) are empty. Nothing is invented.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolveLabAlias } from "../lib/labAliases.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_CATALOG_PATH = path.join(__dirname, "..", "catalog", "labs.json");

export const DEFAULT_LEVELS = {
  foundation: {
    label: "Foundation",
    order: 1,
    description: "First hands-on contact with the subject. Guided tasks, core commands and concepts.",
  },
  intermediate: {
    label: "Intermediate",
    order: 2,
    description: "Multi-step tasks, real tooling, troubleshooting.",
  },
  advanced: {
    label: "Advanced",
    order: 3,
    description: "Open-ended, multi-component or production-style scenarios.",
  },
};

const COMPLEXITY_TO_LEVEL = {
  beginner: "foundation",
  basic: "foundation",
  easy: "foundation",
  foundation: "foundation",
  intermediate: "intermediate",
  medium: "intermediate",
  advanced: "advanced",
  hard: "advanced",
};

// Kept in API responses for one release so old clients still get `complexity`.
const LEVEL_TO_COMPLEXITY = { foundation: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };

let cached = null;

const loadCatalogFile = () => {
  const file = process.env.LAB_CATALOG_PATH || DEFAULT_CATALOG_PATH;
  if (!fs.existsSync(file)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    const labs = Array.isArray(parsed) ? parsed : parsed.labs;
    if (!Array.isArray(labs)) throw new Error("expected { labs: [...] }");
    return { levels: parsed.levels || null, labs, file };
  } catch (err) {
    console.error(`[labCatalog] Ignoring invalid catalog at ${file}: ${err.message}`);
    return null;
  }
};

export const getCatalog = () => {
  if (cached) return cached;
  const file = loadCatalogFile();
  const byId = new Map();
  for (const entry of file?.labs || []) {
    if (entry?.id) byId.set(String(entry.id).toLowerCase(), entry);
  }
  cached = { loaded: Boolean(file), levels: { ...DEFAULT_LEVELS, ...(file?.levels || {}) }, byId };
  if (file) console.log(`[labCatalog] Loaded ${byId.size} labs from ${file.file}`);
  return cached;
};

/** Catalog entry for a lab id (aliases such as dbms-lab resolve to their new id). */
export const getCatalogEntry = (labId) => {
  if (!labId) return null;
  const { byId } = getCatalog();
  return byId.get(String(resolveLabAlias(labId)).toLowerCase()) || byId.get(String(labId).toLowerCase()) || null;
};

const levelFromComplexity = (complexity) =>
  COMPLEXITY_TO_LEVEL[String(complexity || "").toLowerCase().trim()] || "intermediate";

/** Adds catalog fields to a normalized lab object (from labService). */
export const enrichLabWithCatalog = (lab) => {
  if (!lab) return lab;
  const { levels } = getCatalog();
  const entry = getCatalogEntry(lab.id);
  const level = entry?.level && levels[entry.level] ? entry.level : levelFromComplexity(lab.complexity);
  const levelInfo = levels[level] || DEFAULT_LEVELS.intermediate;

  return {
    ...lab,
    title: entry?.title || lab.title,
    category: entry?.category || lab.category,
    durationMinutes: entry?.durationMinutes ?? lab.durationMinutes,
    level,
    levelLabel: levelInfo.label,
    levelOrder: levelInfo.order,
    levelNote: entry?.levelNote || "",
    // Deprecated: derived from level, kept for old clients.
    complexity: LEVEL_TO_COMPLEXITY[level] || lab.complexity,
    kind: entry?.kind || lab.kind || "container",
    labType: entry?.labType || lab.labType,
    topics: entry?.topics || [],
    notCovered: entry?.notCovered || [],
    prerequisites: entry?.prerequisites || [],
    nextLabs: entry?.nextLabs || [],
    ui: entry?.ui || lab.ui || null,
    extraTools: entry?.extraTools || [],
    // ready | new | beta | retired (separate from the labs table's active/inactive `status`).
    catalogStatus: entry?.status || "ready",
  };
};

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

/**
 * Applies GET /labs filters (?level=foundation,intermediate&kind=aws-console) and hides retired
 * labs. Sorted by level order, then title.
 */
export const filterAndSortLabs = (labs, query = {}) => {
  const levels = parseList(query.level);
  const kinds = parseList(query.kind);
  return labs
    .filter((l) => l.catalogStatus !== "retired")
    .filter((l) => !levels.length || levels.includes(l.level))
    .filter((l) => !kinds.length || kinds.includes(String(l.kind).toLowerCase()))
    .sort((a, b) => (a.levelOrder - b.levelOrder) || String(a.title).localeCompare(String(b.title)));
};

/** Infra settings for starting a container lab, from the catalog when present. */
export const getCatalogInfra = (labId) => {
  const entry = getCatalogEntry(labId);
  return {
    taskDefinitionFamily: entry?.infra?.taskDefinitionFamily || null,
    securityGroup: entry?.infra?.securityGroup || null,
    sessionEnv: Array.isArray(entry?.sessionEnv) ? entry.sessionEnv : [],
  };
};
