import { labRepository } from "../repositories/labRepository.js";

const OWNER_API_URL = (process.env.OWNER_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const FETCH_TIMEOUT_MS = parseInt(process.env.OWNER_API_TIMEOUT_MS || "5000", 10);

async function fetchFromOwner(endpoint) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
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
    console.error(`[LabService] Owner API communication error for ${endpoint}:`, err.message);
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
    credits: lab.credits ?? lab.Credits ?? 0,
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

class LabService {
  async getAllAdmin(status, tenantId = 'TEN000001') {
    const endpoint = status ? `/api/labs?status=${encodeURIComponent(status)}` : "/api/labs";
    const data = await fetchFromOwner(endpoint);
    let labs = [];
    if (data && Array.isArray(data.labs)) {
      labs = data.labs.map(normalizeLabObject);
    } else {
      console.warn("[LabService] Falling back to repository for getAllAdmin");
      const dbLabs = await labRepository.getAllAdmin(status);
      labs = (dbLabs || []).map(normalizeLabObject);
    }

    try {
      const pool = (await import("../lib/mysql.js")).default;
      const [mappings] = await pool.query(
        "SELECT program_id, semester_id, course_code, lab_id FROM course_lab_mappings WHERE tenant_id = ?",
        [tenantId || 'TEN000001']
      );
      const mapDict = new Map();
      (mappings || []).forEach(m => mapDict.set(String(m.lab_id), m));

      labs.forEach(lab => {
        const m = mapDict.get(String(lab.id)) || mapDict.get(String(lab.labCode));
        if (m) {
          lab.program = m.program_id === '1' ? 'MBAIBOL' : (m.program_id === '2' ? 'MCAOL' : m.program_id);
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

  async getAllActive(tenantId = 'TEN000001') {
    const data = await fetchFromOwner("/api/labs");
    let labs = [];
    if (data && Array.isArray(data.labs)) {
      labs = data.labs.map(normalizeLabObject);
    } else {
      console.warn("[LabService] Falling back to repository for getAllActive");
      const dbLabs = await labRepository.getAllActive();
      labs = (dbLabs || []).map(normalizeLabObject);
    }

    try {
      const pool = (await import("../lib/mysql.js")).default;
      const [mappings] = await pool.query(
        "SELECT program_id, semester_id, course_code, lab_id FROM course_lab_mappings WHERE tenant_id = ?",
        [tenantId || 'TEN000001']
      );
      const mapDict = new Map();
      (mappings || []).forEach(m => mapDict.set(String(m.lab_id), m));

      labs.forEach(lab => {
        const m = mapDict.get(String(lab.id)) || mapDict.get(String(lab.labCode));
        if (m) {
          lab.program = m.program_id === '1' ? 'MBAIBOL' : (m.program_id === '2' ? 'MCAOL' : m.program_id);
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

  async getById(labCodeOrId) {
    if (!labCodeOrId) return null;
    const target = String(labCodeOrId).toLowerCase().trim();
    const cleanTarget = target.replace(/-lab$/, '').replace(/^lab-/, '');

    const data = await fetchFromOwner(`/api/labs/${encodeURIComponent(labCodeOrId)}`);
    if (data && data.lab) {
      return normalizeLabObject(data.lab);
    }
    const dbLab = await labRepository.getById(labCodeOrId);
    if (dbLab) return normalizeLabObject(dbLab);

    const all = await this.getAllActive();
    return all.find((l) => {
      const id = String(l.id || '').toLowerCase();
      const code = String(l.labCode || '').toLowerCase();
      const title = String(l.title || '').toLowerCase();
      const dbId = String(l.dbId || '').toLowerCase();

      return (
        id === target ||
        code === target ||
        title === target ||
        dbId === target ||
        id.replace(/-lab$/, '').replace(/^lab-/, '') === cleanTarget ||
        code.replace(/-lab$/, '').replace(/^lab-/, '') === cleanTarget ||
        title.replace(/\s+/g, '-').replace(/-lab$/, '') === cleanTarget
      );
    }) || null;
  }
}

export const labService = new LabService();
