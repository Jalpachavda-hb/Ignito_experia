import { ok, notFound, serverError } from "../lib/apigw.js";
import { labService } from "../services/labService.js";
import { enrichLabWithCatalog, filterAndSortLabs, getCatalog } from "../services/labCatalog.js";
import { awsLabsInfra } from "../config/awsLabs.js";
import { listAwsLabs } from "../services/awsLabs/awsLabService.js";

// AWS console labs appear in the catalog as kind "aws-console" once the feature is enabled.
const awsConsoleCatalogLabs = () =>
  awsLabsInfra.enabled
    ? listAwsLabs().map((l) => ({
        id: l.id,
        labCode: l.id,
        title: l.title,
        category: "Cloud",
        description: `Work in a real AWS account using the ${l.title} console.`,
        durationMinutes: l.durationMinutes,
        complexity: "Beginner",
        kind: "aws-console",
        status: "active",
        runtimeType: "aws-console",
      }))
    : [];
import requirePermission from "../middleware/PermissionMiddleware.js";

/**
 * Read-only Lab Consumption Handlers for VLab Platform.
 * All Lab Management write operations (Create, Edit, Delete, Status Toggle)
 * exist exclusively in the Owner Platform.
 */

export const labsListHandler = async ({ queryStringParameters } = {}) => {
  try {
    const labs = [...(await labService.getAllActive()), ...awsConsoleCatalogLabs()].map(enrichLabWithCatalog);
    return ok({
      labs: filterAndSortLabs(labs, queryStringParameters || {}),
      levels: getCatalog().levels,
    });
  } catch (error) {
    console.error("[labsListHandler Error]", error);
    return serverError({ success: false, message: `Lab catalog retrieval failed: ${error.message}` });
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
    const lab = enrichLabWithCatalog(
      (await labService.getById(labId)) || awsConsoleCatalogLabs().find((l) => l.id === labId) || null,
    );
    if (!lab) return notFound("Lab not found");
    return ok({ lab, levels: getCatalog().levels });
  } catch (error) {
    console.error("[labsGetHandler Error]", error);
    return serverError({ success: false, message: `Lab details retrieval failed: ${error.message}` });
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
    return serverError({ success: false, message: `Sub labs retrieval failed: ${error.message}` });
  }
};
