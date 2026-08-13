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
  const labCode = lab.labCode || lab.id || String(lab.dbId || "");
  return {
    id: labCode,
    dbId: lab.dbId || lab.LabId,
    labCode: labCode,
    title: lab.title || lab.Title || "Untitled Lab",
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
  async getAllAdmin(status) {
    const endpoint = status ? `/api/labs?status=${encodeURIComponent(status)}` : "/api/labs";
    const data = await fetchFromOwner(endpoint);
    if (data && Array.isArray(data.labs)) {
      return data.labs.map(normalizeLabObject);
    }
    // Safe fallback to database repository if Owner API is unreachable
    console.warn("[LabService] Falling back to repository for getAllAdmin");
    const dbLabs = await labRepository.getAllAdmin(status);
    return (dbLabs || []).map(normalizeLabObject);
  }

  async getAllActive() {
    const data = await fetchFromOwner("/api/labs");
    if (data && Array.isArray(data.labs)) {
      return data.labs.map(normalizeLabObject);
    }
    // Safe fallback to database repository if Owner API is unreachable
    console.warn("[LabService] Falling back to repository for getAllActive");
    const dbLabs = await labRepository.getAllActive();
    return (dbLabs || []).map(normalizeLabObject);
  }

  async getById(labCodeOrId) {
    const data = await fetchFromOwner(`/api/labs/${encodeURIComponent(labCodeOrId)}`);
    if (data && data.lab) {
      return normalizeLabObject(data.lab);
    }
    // Safe fallback
    const all = await this.getAllActive();
    return all.find((l) => l.id === labCodeOrId || String(l.dbId) === String(labCodeOrId)) || null;
  }
}

export const labService = new LabService();
