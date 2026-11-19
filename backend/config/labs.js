import { labService } from "../services/labService.js";
import { resolveLabAlias } from "../lib/labAliases.js";

export { resolveLabAlias };

export const LAB_PORTS = {
  JUPYTER: 8888,
  WEB_LAB: 8080,
};

export const getLabById = async (labId) => {
  return await labService.getById(resolveLabAlias(labId));
};
