import { ok, notFound, serverError } from "../lib/apigw.js";
import { badRequest } from "../lib/errors.js";
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

export const labsCreateHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "create");
    const creatorId = parsed.auth?.userId;
    const newLab = await labService.insertLab({
      ...parsed.body,
      CreatedBy: creatorId
    });
    return ok({
      success: true,
      message: "Lab created successfully",
      data: newLab
    });
  } catch (error) {
    console.error("[labsCreateHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};

export const labsUpdateHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "update");
    const { labId } = parsed.pathParameters || {};
    const updatedBy = parsed.auth?.userId;

    const updatedLab = await labService.updateLab(labId, {
      ...parsed.body,
      UpdatedBy: updatedBy
    });

    return ok({
      success: true,
      message: "Lab updated successfully",
      data: updatedLab
    });
  } catch (error) {
    console.error("[labsUpdateHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};

export const labsDeleteHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "delete");
    const { labId } = parsed.pathParameters || {};
    const updatedBy = parsed.auth?.userId;

    const result = await labService.deleteLab(labId, updatedBy);

    return ok({
      success: true,
      message: "Lab deleted successfully",
      data: result
    });
  } catch (error) {
    console.error("[labsDeleteHandler Error]", error);
    return serverError({ success: false, message: `Database operation failed: ${error.message}` });
  }
};

export const labsUpdateStatusHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "update");
    const { labId } = parsed.pathParameters || {};
    const { status } = parsed.body || {};
    if (!status) throw badRequest("status is required");

    const updatedBy = parsed.auth?.userId;
    const result = await labService.updateLabStatus(labId, status, updatedBy);

    return ok({
      success: true,
      message: "Lab status updated successfully",
      data: result
    });
  } catch (error) {
    console.error("[labsUpdateStatusHandler Error]", error);
    throw error;
  }
};
