import { labService } from "../services/LabService.js";
import { ok, notFound, serverError, badRequest } from "../lib/apigw.js";

const validateLabPayload = (body) => {
  if (!body.labCode) return "labCode is required";
  if (!body.title) return "title is required";
  if (!body.runtimeType) return "runtimeType is required";
  return null;
};

export async function labsAdminListHandler(req, res) {
  try {
    const status = req.query?.status;
    const labs = await labService.getAllAdmin(status);
    const resp = ok({ success: true, labs });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[labsAdminListHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function labsListHandler(req, res) {
  try {
    const labs = await labService.getAllActive();
    const resp = ok({ success: true, labs });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[labsListHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function labsGetHandler(req, res) {
  try {
    const labId = req.params?.labId;
    const lab = await labService.getById(labId);
    if (!lab) {
      const resp = notFound("Lab not found");
      return res.status(resp.statusCode).json(resp.body);
    }
    const resp = ok({ success: true, lab });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[labsGetHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function createLabHandler(req, res) {
  try {
    const body = req.body;
    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      const resp = badRequest(errorMsg);
      return res.status(resp.statusCode).json(resp.body);
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
      CreatedBy: req.auth?.ownerId,
    };

    const result = await labService.insertLab(payload);
    return res.status(201).json({ success: true, message: "Lab created successfully", data: result });
  } catch (err) {
    console.error("[createLabHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function updateLabHandler(req, res) {
  try {
    const labId = req.params?.labId;
    if (!labId) {
      const resp = badRequest("labId is required");
      return res.status(resp.statusCode).json(resp.body);
    }

    const body = req.body;
    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      const resp = badRequest(errorMsg);
      return res.status(resp.statusCode).json(resp.body);
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
      UpdatedBy: req.auth?.ownerId,
    };

    const result = await labService.updateLab(labId, payload);
    const resp = ok({ success: true, message: "Lab updated successfully", data: result });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[updateLabHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function updateLabStatusHandler(req, res) {
  try {
    const labId = req.params?.labId;
    const status = req.body?.status;

    if (!labId) {
      const resp = badRequest("labId is required");
      return res.status(resp.statusCode).json(resp.body);
    }
    if (!status || !["active", "inactive"].includes(status)) {
      const resp = badRequest("status must be 'active' or 'inactive'");
      return res.status(resp.statusCode).json(resp.body);
    }

    const result = await labService.updateLabStatus(labId, status, req.auth?.ownerId);
    const resp = ok({ success: true, message: "Lab status updated successfully", data: result });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[updateLabStatusHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}

export async function deleteLabHandler(req, res) {
  try {
    const labId = req.params?.labId;
    if (!labId) {
      const resp = badRequest("labId is required");
      return res.status(resp.statusCode).json(resp.body);
    }

    const result = await labService.deleteLab(labId, req.auth?.ownerId);
    const resp = ok({ success: true, message: "Lab deleted successfully", data: result });
    return res.status(resp.statusCode).json(resp.body);
  } catch (err) {
    console.error("[deleteLabHandler]", err);
    const resp = serverError({ success: false, message: err.message });
    return res.status(resp.statusCode).json(resp.body);
  }
}
