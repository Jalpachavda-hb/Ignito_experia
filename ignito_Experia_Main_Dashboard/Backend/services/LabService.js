import { labRepository } from "../repositories/labRepository.js";

const mapDbLabToApi = (dbLab) => ({
  id: dbLab.LabCode,
  dbId: dbLab.LabId,
  labCode: dbLab.LabCode,
  title: dbLab.Title,
  subtitle: dbLab.Subtitle,
  logo: dbLab.Logo,
  logoUrl: dbLab.Logo,
  durationMinutes: dbLab.DurationMinutes,
  credits: dbLab.Credits,
  complexity: dbLab.Complexity,
  category: dbLab.Category,
  description: dbLab.Description,
  status: dbLab.Status,
  taskDefinition: dbLab.TaskDefinition,
  runtimeType: dbLab.RuntimeType,
  runtimePort: dbLab.RuntimePort,
  runtimePath: dbLab.RuntimePath,
  runtime: {
    type: dbLab.RuntimeType,
    port: dbLab.RuntimePort,
    path: dbLab.RuntimePath,
    containerApi: {
      enabled: Boolean(dbLab.ContainerApiEnabled),
      port: dbLab.ContainerApiPort,
    },
  },
  containerApiEnabled: Boolean(dbLab.ContainerApiEnabled),
  containerApiPort: dbLab.ContainerApiPort,
  displayOrder: dbLab.DisplayOrder,
  isDeleted: Boolean(dbLab.IsDeleted),
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
    const found = await labRepository.getById(labCodeOrId);
    return found ? mapDbLabToApi(found) : null;
  }

  async insertLab(labData) {
    return await labRepository.insert(labData);
  }

  async updateLab(labId, labData) {
    return await labRepository.update(labId, labData);
  }

  async deleteLab(labId, userId) {
    return await labRepository.softDelete(labId, userId);
  }

  async updateLabStatus(labId, status, userId) {
    return await labRepository.updateStatus(labId, status, userId);
  }
}

export const labService = new LabService();
