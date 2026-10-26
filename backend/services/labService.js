import { labRepository } from "../repositories/labRepository.js";
import { cacheProvider } from "../lib/cache.js";

const OWNER_API_URL = (process.env.OWNER_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const FETCH_TIMEOUT_MS = parseInt(process.env.OWNER_API_TIMEOUT_MS || "5000", 10);

let lastOwnerFailureTime = 0;
const OWNER_COOLDOWN_MS = 20000;

async function fetchFromOwner(endpoint) {
  if (Date.now() - lastOwnerFailureTime < OWNER_COOLDOWN_MS) {
    return null;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.min(FETCH_TIMEOUT_MS, 1500));
  try {
    const url = `${OWNER_API_URL}${endpoint}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[LabService] Owner API request returned ${response.status} for ${url}`);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    lastOwnerFailureTime = Date.now();
    console.warn(`[LabService] Owner API unavailable for ${endpoint} (${err.message}). Using database fallback.`);
    return null;
  }
}

const normalizeLabObject = (lab) => {
  if (!lab) return null;
  const labCode = lab.labCode || lab.lab_code || lab.LabCode || lab.id || lab.labId || lab.LabId || (lab.dbId ? String(lab.dbId) : "") || (lab._id ? String(lab._id) : "");
  return {
    id: labCode,
    dbId: lab.dbId || lab.LabId || lab._id || lab.id,
    labCode: labCode,
    title: lab.title || lab.Title || lab.name || lab.Name || "Untitled Lab",
    subtitle: lab.subtitle || lab.Subtitle || "",
    semester: lab.semester || lab.Semester || "",
    logo: lab.logo || lab.logoUrl || lab.Logo || "",
    logoUrl: lab.logoUrl || lab.logo || lab.Logo || "",
    durationMinutes: lab.durationMinutes ?? lab.DurationMinutes ?? 60,
    credits: lab.credits ?? lab.Credits ?? (lab.baseTokenPrice != null ? Number(lab.baseTokenPrice) : (lab.BaseTokenPrice != null ? Number(lab.BaseTokenPrice) : 0)),
    baseTokenPrice: lab.baseTokenPrice != null ? Number(lab.baseTokenPrice) : (lab.BaseTokenPrice != null ? Number(lab.BaseTokenPrice) : (lab.credits != null ? Number(lab.credits) : (lab.tokenCost != null ? Number(lab.tokenCost) : 100))),
    pricePer60Tokens: lab.baseTokenPrice != null ? Number(lab.baseTokenPrice) : (lab.BaseTokenPrice != null ? Number(lab.BaseTokenPrice) : (lab.credits != null ? Number(lab.credits) : (lab.tokenCost != null ? Number(lab.tokenCost) : 100))),
    complexity: lab.complexity || lab.Complexity || "Intermediate",
    category: lab.category || lab.Category || "Development",
    description: lab.description || lab.Description || "",
    status: lab.status || lab.Status || "active",
    taskDefinition: lab.taskDefinition || lab.TaskDefinition || "",
    runtimeType: lab.runtimeType || lab.RuntimeType || lab.runtime?.type || "ide",
    runtimePort: lab.runtimePort ?? lab.RuntimePort ?? lab.runtime?.port ?? null,
    runtimePath: lab.runtimePath || lab.RuntimePath || lab.runtime?.path || "",
    runtime: lab.runtime || {
      type: lab.runtimeType || lab.RuntimeType || "ide",
      port: lab.runtimePort ?? lab.RuntimePort ?? null,
      path: lab.runtimePath || lab.RuntimePath || "",
      containerApi: {
        enabled: Boolean(lab.containerApiEnabled ?? lab.ContainerApiEnabled),
        port: lab.containerApiPort ?? lab.ContainerApiPort ?? null,
      },
    },
    containerApiEnabled: Boolean(lab.containerApiEnabled ?? lab.ContainerApiEnabled),
    containerApiPort: lab.containerApiPort ?? lab.ContainerApiPort ?? null,
    displayOrder: lab.displayOrder ?? lab.DisplayOrder ?? 0,
    createdAt: lab.createdAt || lab.CreatedDate || new Date().toISOString(),
    updatedAt: lab.updatedAt || lab.UpdatedDate || new Date().toISOString(),
  };
};

const LAB_HIT_TTL_SECONDS = 60;
const LAB_MISS_TTL_SECONDS = 15;
const LAB_LIST_TTL_SECONDS = 45;

function lookupKeys(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return [];
  const clean = raw.replace(/-lab$/, "").replace(/^lab-/, "");
  const slug = raw.replace(/\s+/g, "-").replace(/-lab$/, "");
  return [...new Set([raw, clean, `${clean}-lab`, `lab-${clean}`, slug].filter(Boolean))];
}

function labMatches(lab, labCodeOrId) {
  const target = String(labCodeOrId).toLowerCase().trim();
  const cleanTarget = target.replace(/-lab$/, "").replace(/^lab-/, "");
  const id = String(lab.id || "").toLowerCase();
  const code = String(lab.labCode || "").toLowerCase();
  const title = String(lab.title || "").toLowerCase();
  const dbId = String(lab.dbId || "").toLowerCase();
  return (
    id === target ||
    code === target ||
    title === target ||
    dbId === target ||
    id.replace(/-lab$/, "").replace(/^lab-/, "") === cleanTarget ||
    code.replace(/-lab$/, "").replace(/^lab-/, "") === cleanTarget ||
    title.replace(/\s+/g, "-").replace(/-lab$/, "") === cleanTarget
  );
}

class LabService {
  constructor() {
    this.byIdFlight = new Map();
    this.listFlight = new Map();
  }

  async remember(lab) {
    if (!lab) return;
    const keys = new Set([
      ...lookupKeys(lab.id),
      ...lookupKeys(lab.labCode),
      ...lookupKeys(lab.dbId),
      ...lookupKeys(lab.title),
    ]);
    await Promise.all(
      [...keys].map((key) => cacheProvider.set(`lab:v1:${key}`, { found: true, lab }, LAB_HIT_TTL_SECONDS))
    );
  }

  async attachMappings(labs, tenantId = null) {
    if (!labs.length) return labs;
    try {
      const pool = (await import("../lib/mysql.js")).default;
      const [mappings] = tenantId
        ? await pool.query(
            "SELECT program_id, semester_id, course_code, lab_id FROM course_lab_mappings WHERE tenant_id = ?",
            [tenantId]
          )
        : await pool.query(
            "SELECT program_id, semester_id, course_code, lab_id FROM course_lab_mappings"
          );
      const mapDict = new Map();
      (mappings || []).forEach((m) => mapDict.set(String(m.lab_id), m));

      labs.forEach((lab) => {
        const m = mapDict.get(String(lab.id)) || mapDict.get(String(lab.labCode));
        if (m) {
          lab.program = m.program_id === "1" ? "MBAIBOL" : (m.program_id === "2" ? "MCAOL" : m.program_id);
          lab.semester = `Semester ${m.semester_id}`;
          lab.course = m.course_code;
        } else {
          lab.program = null;
          lab.semester = null;
          lab.course = null;
        }
      });
    } catch (e) {
      console.warn("[LabService] Error attaching course_lab_mappings:", e.message);
    }
    return labs;
  }

  async loadCatalog(kind, status) {
    if (kind === "admin") {
      const dbLabs = await labRepository.getAllAdmin(status);
      if (dbLabs?.length) return dbLabs.map(normalizeLabObject);
      const endpoint = status ? `/api/labs?status=${encodeURIComponent(status)}` : "/api/labs";
      const data = await fetchFromOwner(endpoint);
      if (data && Array.isArray(data.labs)) return data.labs.map(normalizeLabObject);
      return [];
    }

    const dbLabs = await labRepository.getAllActive();
    if (dbLabs?.length) return dbLabs.map(normalizeLabObject);
    const data = await fetchFromOwner("/api/labs");
    if (data && Array.isArray(data.labs)) return data.labs.map(normalizeLabObject);
    return [];
  }

  async getCatalog(kind, status, tenantId = null) {
    const cacheKey = `labs:${kind}:${status || "all"}:${tenantId || "all"}`;
    const cached = await cacheProvider.get(cacheKey);
    if (Array.isArray(cached)) return cached.map((lab) => ({ ...lab }));

    if (this.listFlight.has(cacheKey)) return this.listFlight.get(cacheKey);

    const job = (async () => {
      const labs = await this.attachMappings(await this.loadCatalog(kind, status), tenantId);
      await cacheProvider.set(cacheKey, labs, LAB_LIST_TTL_SECONDS);
      await Promise.all(labs.map((lab) => this.remember(lab)));
      return labs.map((lab) => ({ ...lab }));
    })().finally(() => this.listFlight.delete(cacheKey));

    this.listFlight.set(cacheKey, job);
    return job;
  }

  async getAllAdmin(status, tenantId = null) {
    return this.getCatalog("admin", status || null, tenantId);
  }

  async getAllActive(tenantId = null) {
    return this.getCatalog("active", null, tenantId);
  }

  async getById(labCodeOrId) {
    if (!labCodeOrId) return null;
    const keys = lookupKeys(labCodeOrId);
    for (const key of keys) {
      const cached = await cacheProvider.get(`lab:v1:${key}`);
      if (cached?.found) return cached.lab ? { ...cached.lab } : null;
    }

    const flightKey = keys[0] || String(labCodeOrId).toLowerCase();
    if (this.byIdFlight.has(flightKey)) return this.byIdFlight.get(flightKey);

    const job = this.loadById(labCodeOrId, keys).finally(() => this.byIdFlight.delete(flightKey));
    this.byIdFlight.set(flightKey, job);
    return job;
  }

  async loadById(labCodeOrId, keys) {
    const found = await labRepository.findByCode(labCodeOrId);
    if (found?.row) {
      const lab = normalizeLabObject(found.row);
      await this.remember(lab);
      return { ...lab };
    }

    if (!found?.ownerReachable) {
      const data = await fetchFromOwner(`/api/labs/${encodeURIComponent(labCodeOrId)}`);
      if (data?.lab) {
        const lab = normalizeLabObject(data.lab);
        await this.remember(lab);
        return { ...lab };
      }
    }

    const catalog = await this.getAllActive();
    const match = catalog.find((lab) => labMatches(lab, labCodeOrId)) || null;
    if (match) {
      await this.remember(match);
      return { ...match };
    }

    await Promise.all(
      keys.map((key) => cacheProvider.set(`lab:v1:${key}`, { found: true, lab: null }, LAB_MISS_TTL_SECONDS))
    );
    return null;
  }
}

export const labService = new LabService();
