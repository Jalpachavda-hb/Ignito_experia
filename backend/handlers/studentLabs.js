import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import studentLabAccessService from "../services/StudentLabAccessService.js";

/**
 * GET /student/labs/access[?refresh=1]
 * The labs this student may use: university-assigned (LMS courses -> course_lab_mappings)
 * plus purchased, one entry per lab, each with its source and lab-specific token balance.
 * The backend decides; the dashboard only renders this list.
 */
export const studentLabAccessHandler = async ({ auth, queryStringParameters = {} }) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  const refresh = ["1", "true", "yes"].includes(String(queryStringParameters.refresh || "").toLowerCase());
  const result = await studentLabAccessService.getAccess(auth, { forceRefresh: refresh });
  return ok(result);
};
