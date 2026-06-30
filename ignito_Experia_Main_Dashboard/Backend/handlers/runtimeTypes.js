import { runtimeTypesRepository } from "../repositories/runtimeTypesRepository.js";
import { ok, serverError } from "../lib/apigw.js";

export async function runtimeTypesListHandler(req, res) {
  try {
    const runtimeTypes = await runtimeTypesRepository.getAll();
    const resp = ok({ success: true, runtimeTypes });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[runtimeTypesListHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}
