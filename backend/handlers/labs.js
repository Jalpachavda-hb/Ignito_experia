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

const validateLabPayload = (body) => {
  const { labCode, title, runtimeType } = body;
  if (!labCode) return "labCode is required";
  if (!title) return "title is required";
  if (!runtimeType) return "runtimeType is required";

  return null;
};

export const createLabHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "create");
    const { body, auth } = parsed;
    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      return { statusCode: 400, body: { success: false, message: errorMsg } };
    }

    const payload = {
      LabCode: body.labCode,
      Title: body.title,
      Subtitle: body.subtitle,
      Semester: body.semester,
      Logo: body.logoUrl,
      DurationMinutes: parseInt(body.durationMinutes, 10) || 0,
      Credits: parseInt(body.credits, 10) || 0,
      Complexity: body.complexity,
      Category: body.category,
      Description: body.description,
      TaskDefinition: body.taskDefinition,
      RuntimeType: body.runtimeType,
      RuntimePort: parseInt(body.runtimePort, 10) || null,
      RuntimePath: body.runtimePath,
      ContainerApiEnabled: body.containerApiEnabled === "true" || body.containerApiEnabled === true,
      ContainerApiPort: parseInt(body.containerApiPort, 10) || null,
      DisplayOrder: parseInt(body.displayOrder, 10) || 0,
      CreatedBy: auth?.userId,
    };

    const result = await labService.insertLab(payload);
    return ok({ message: "Lab created successfully", data: result }, 201);
  } catch (error) {
    throw error;
  }
};

export const updateLabHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "update");
    const { pathParameters, body, auth } = parsed;
    const labId = pathParameters?.labId;
    if (!labId) return { statusCode: 400, body: { success: false, message: "labId is required" } };

    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      return { statusCode: 400, body: { success: false, message: errorMsg } };
    }

    const payload = {
      LabCode: body.labCode,
      Title: body.title,
      Subtitle: body.subtitle,
      Semester: body.semester,
      Logo: body.logoUrl,
      DurationMinutes: parseInt(body.durationMinutes, 10) || 0,
      Credits: parseInt(body.credits, 10) || 0,
      Complexity: body.complexity,
      Category: body.category,
      Description: body.description,
      TaskDefinition: body.taskDefinition,
      RuntimeType: body.runtimeType,
      RuntimePort: parseInt(body.runtimePort, 10) || null,
      RuntimePath: body.runtimePath,
      ContainerApiEnabled: body.containerApiEnabled === "true" || body.containerApiEnabled === true,
      ContainerApiPort: parseInt(body.containerApiPort, 10) || null,
      DisplayOrder: parseInt(body.displayOrder, 10) || 0,
      UpdatedBy: auth?.userId,
    };

    const result = await labService.updateLab(labId, payload);
    return ok({ message: "Lab updated successfully", data: result });
  } catch (error) {
    throw error;
  }
};

export const updateLabStatusHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "update");
    const { pathParameters, body, auth } = parsed;
    const labId = pathParameters?.labId;
    const status = body?.status;
    
    if (!labId) return { statusCode: 400, body: { success: false, message: "labId is required" } };
    if (!status || !["active", "inactive"].includes(status)) {
      return { statusCode: 400, body: { success: false, message: "status is required and must be active or inactive" } };
    }

    const result = await labService.updateLabStatus(labId, status, auth?.userId);
    return ok({ message: "Lab status updated successfully", data: result });
  } catch (error) {
    throw error;
  }
};

export const deleteLabHandler = async (parsed) => {
  try {
    await requirePermission(parsed, "LAB_MANAGEMENT", "delete");
    const { pathParameters, auth } = parsed;
    const labId = pathParameters?.labId;
    if (!labId) return { statusCode: 400, body: { success: false, message: "labId is required" } };

    const result = await labService.deleteLab(labId, auth?.userId);
    return ok({ message: "Lab deleted successfully", data: result });
  } catch (error) {
    throw error;
  }
};