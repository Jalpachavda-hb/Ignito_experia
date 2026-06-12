import { labService } from "../services/labService.js";

export const LAB_PORTS = {
  JUPYTER: 8888,
  WEB_LAB: 8080,
};

export const getLabById = async (labId) => {
  return await labService.getById(labId);
};
