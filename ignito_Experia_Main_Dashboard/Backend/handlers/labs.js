import { labService } from "../services/LabService.js";
import { ok, notFound, serverError, badRequest } from "../lib/apigw.js";

const validateLabPayload = (body) => {
  const code = body.labCode || body.id;
  if (!code) return "labCode (or id) is required";
  if (!body.title) return "title is required";
  if (!body.runtimeType) return "runtimeType is required";
  return null;
};

export async function labsAdminListHandler(req, res) {
  try {
    const status = req.query?.status;
    const labs = await labService.getAllAdmin(status);
    return res.status(200).json({ success: true, labs });
  } catch (err) {
    console.error("[labsAdminListHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function labsListHandler(req, res) {
  try {
    const labs = await labService.getAllActive();
    return res.status(200).json({ success: true, labs });
  } catch (err) {
    console.error("[labsListHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function labsGetHandler(req, res) {
  try {
    const labId = req.params?.labId;
    const lab = await labService.getById(labId);
    if (!lab) {
      return res.status(404).json({ success: false, message: "Lab not found" });
    }
    return res.status(200).json({ success: true, lab });
  } catch (err) {
    console.error("[labsGetHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createLabHandler(req, res) {
  try {
    const body = req.body;
    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    const payload = {
      LabCode: body.labCode || body.id,
      Title: body.title,
      Subtitle: body.subtitle,
      Logo: body.logoUrl || body.logo,
      DurationMinutes: parseInt(body.durationMinutes, 10) || 0,
      Credits: parseInt(body.credits, 10) || 0,
      Complexity: body.complexity,
      Category: body.category,
      Description: body.description,
      TaskDefinition: body.taskDefinition,
      RuntimeType: body.runtimeType,
      RuntimePort: body.runtimePort != null && body.runtimePort !== "" ? parseInt(body.runtimePort, 10) : null,
      RuntimePath: body.runtimePath,
      ContainerApiEnabled: body.containerApiEnabled === "true" || body.containerApiEnabled === true || body.containerApiEnabled === 1,
      ContainerApiPort: body.containerApiPort != null && body.containerApiPort !== "" ? parseInt(body.containerApiPort, 10) : null,
      DisplayOrder: parseInt(body.displayOrder, 10) || 0,
      CreatedBy: req.auth?.ownerId,
    };

    const result = await labService.insertLab(payload);
    return res.status(201).json({ success: true, message: "Lab created successfully", data: result });
  } catch (err) {
    console.error("[createLabHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateLabHandler(req, res) {
  try {
    const labId = req.params?.labId;
    if (!labId) {
      return res.status(400).json({ success: false, message: "labId is required" });
    }

    const body = req.body;
    const errorMsg = validateLabPayload(body);
    if (errorMsg) {
      return res.status(400).json({ success: false, message: errorMsg });
    }

    const payload = {
      LabCode: body.labCode || body.id,
      Title: body.title,
      Subtitle: body.subtitle,
      Logo: body.logoUrl || body.logo,
      DurationMinutes: parseInt(body.durationMinutes, 10) || 0,
      Credits: parseInt(body.credits, 10) || 0,
      Complexity: body.complexity,
      Category: body.category,
      Description: body.description,
      TaskDefinition: body.taskDefinition,
      RuntimeType: body.runtimeType,
      RuntimePort: body.runtimePort != null && body.runtimePort !== "" ? parseInt(body.runtimePort, 10) : null,
      RuntimePath: body.runtimePath,
      ContainerApiEnabled: body.containerApiEnabled === "true" || body.containerApiEnabled === true || body.containerApiEnabled === 1,
      ContainerApiPort: body.containerApiPort != null && body.containerApiPort !== "" ? parseInt(body.containerApiPort, 10) : null,
      DisplayOrder: parseInt(body.displayOrder, 10) || 0,
      UpdatedBy: req.auth?.ownerId,
    };

    const result = await labService.updateLab(labId, payload);
    return res.status(200).json({ success: true, message: "Lab updated successfully", data: result });
  } catch (err) {
    console.error("[updateLabHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateLabStatusHandler(req, res) {
  try {
    const labId = req.params?.labId;
    const status = req.body?.status;

    if (!labId) {
      return res.status(400).json({ success: false, message: "labId is required" });
    }
    if (!status || !["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be 'active' or 'inactive'" });
    }

    const result = await labService.updateLabStatus(labId, status, req.auth?.ownerId);
    return res.status(200).json({ success: true, message: "Lab status updated successfully", data: result });
  } catch (err) {
    console.error("[updateLabStatusHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteLabHandler(req, res) {
  try {
    const labId = req.params?.labId;
    if (!labId) {
      return res.status(400).json({ success: false, message: "labId is required" });
    }

    const result = await labService.deleteLab(labId, req.auth?.ownerId);
    return res.status(200).json({ success: true, message: "Lab deleted successfully", data: result });
  } catch (err) {
    console.error("[deleteLabHandler]", err);
    return res.status(500).json({ success: false, message: err.message });
  }
}
