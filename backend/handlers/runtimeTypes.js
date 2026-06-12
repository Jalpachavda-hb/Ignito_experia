import { ok, serverError } from "../lib/apigw.js";
import { runtimeTypesRepository } from "../repositories/runtimeTypesRepository.js";

export const runtimeTypesListHandler = async () => {
  try {
    const runtimeTypes = await runtimeTypesRepository.getAllActive();
    return ok({ runtimeTypes });
  } catch (error) {
    console.error("[runtimeTypesListHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};
