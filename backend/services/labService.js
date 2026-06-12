import { labRepository } from "../repositories/labRepository.js";

const mapDbLabToApi = (dbLab) => ({
  id: dbLab.LabCode, // Frontend expects 'id' as the LabCode
  dbId: dbLab.LabId, // Keep original DB ID if needed
  title: dbLab.Title,
  subtitle: dbLab.Subtitle,
  semester: dbLab.Semester,
  logo: dbLab.Logo,
  durationMinutes: dbLab.DurationMinutes,
  credits: dbLab.Credits,
  complexity: dbLab.Complexity,
  category: dbLab.Category,
  description: dbLab.Description,
  status: dbLab.Status,
  taskDefinition: dbLab.TaskDefinition,
  runtime: {
    type: dbLab.RuntimeType,
    port: dbLab.RuntimePort,
    path: dbLab.RuntimePath,
    containerApi: {
      enabled: Boolean(dbLab.ContainerApiEnabled),
      port: dbLab.ContainerApiPort,
    },
  },
  displayOrder: dbLab.DisplayOrder,
  createdAt: dbLab.CreatedDate,
  updatedAt: dbLab.UpdatedDate,
});

class LabService {
  async getAllAdmin(status) {
    const dbLabs = await labRepository.getAllAdmin(status);
    return dbLabs.map(mapDbLabToApi);
  }

  async getAllActive() {
    const dbLabs = await labRepository.getAllActive();
    return dbLabs.map(mapDbLabToApi);
  }

  async getById(labCodeOrId) {
    // If it's a string like 'linux-lab', we need to find it by LabCode
    // Wait, getById in repo takes LabId. But frontend uses `id` as `linux-lab` (LabCode).
    // Let's fetch all active and find by LabCode. For enterprise, we should ideally have sp_Lab_GetByCode.
    // For now, fetching all active and filtering is a temporary workaround or we can just do that.
    const dbLabs = await labRepository.getAllAdmin(); // Fetching admin so we can find it even if inactive
    const found = dbLabs.find(
      (l) => l.LabCode === labCodeOrId || String(l.LabId) === String(labCodeOrId)
    );
    return found ? mapDbLabToApi(found) : null;
  }

  async insertLab(labData) {
    const result = await labRepository.insert(labData);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async updateLab(labId, labData) {
    const result = await labRepository.update(labId, labData);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async deleteLab(labId, userId) {
    const result = await labRepository.softDelete(labId, userId);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async restoreLab(labId, userId) {
    const result = await labRepository.restore(labId, userId);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }

  async updateLabStatus(labId, status, userId) {
    const result = await labRepository.updateStatus(labId, status, userId);
    if (result && result.Status === "Error") {
      throw new Error(result.Message);
    }
    return result;
  }
}

export const labService = new LabService();
