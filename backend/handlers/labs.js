import { ok, notFound, serverError } from "../lib/apigw.js";
import { labService } from "../services/labService.js";
import requirePermission from "../middleware/PermissionMiddleware.js";

export const labsListHandler = async () => {
  try {
    const labs = await labService.getAllActive();
    return ok({ labs });
  } catch (error) {
    console.error("[labsListHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};

export const labsAdminListHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "read");
    const { queryStringParameters } = parsed;
    const status = queryStringParameters?.status;
    const labs = await labService.getAllAdmin(status);
    return ok({ labs });
  } catch (error) {
    console.error("[labsAdminListHandler Error]", error);
    throw error;
  }
};

export const labsGetHandler = async ({ pathParameters }) => {
  try {
    const labId = pathParameters?.labId;
    const lab = await labService.getById(labId);
    if (!lab) return notFound("Lab not found");
    return ok({ lab });
  } catch (error) {
    console.error("[labsGetHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};

export const subLabsHandler = async () => {
  try {
    const labs = await labService.getAllActive();
    const grouped = {};

    labs.forEach((lab) => {
      const semester = lab.semester || "Other";
      if (!grouped[semester]) {
        grouped[semester] = [];
      }
      grouped[semester].push(lab);
    });

    return ok({ subLabs: grouped });
  } catch (error) {
    console.error("[subLabsHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};
