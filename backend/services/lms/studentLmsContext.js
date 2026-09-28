import pool from "../../lib/mysql.js";
import { unauthorized } from "../../lib/errors.js";
import {
  PLATFORM_TENANT_ID,
  isUniversityIdentity,
  loadLmsProvider,
  loadTenantById,
} from "../../lib/studentAccess.js";
import { cleanLmsId } from "./lmsIds.js";

export function identityFromUser(profile) {
  const admissionId = cleanLmsId(profile?.StudentDegreeAdmissionId);
  const studentId = cleanLmsId(profile?.StudentId);
  const storedExternal = cleanLmsId(profile?.ExternalStudentId);
  const externalStudentId = studentId || storedExternal || admissionId;
  return {
    admissionId: admissionId || storedExternal || externalStudentId,
    studentId: studentId || storedExternal || null,
    externalStudentId,
  };
}

export async function loadStudentLmsContext(auth) {
  if (!auth?.userId) throw unauthorized("Authentication required");

  const [rows] = await pool.query("SELECT * FROM users WHERE UserId = ? LIMIT 1", [auth.userId]);
  const profile = rows?.[0];
  if (!profile) throw unauthorized("User not found or inactive");

  let tenantId = profile.TenantId || auth.tenantId || null;
  if (!tenantId || String(tenantId) === PLATFORM_TENANT_ID) {
    const [utmRows] = await pool.query(
      "SELECT TenantId FROM user_tenant_mapping WHERE UserId = ? AND Status = 'ACTIVE' AND TenantId <> ? ORDER BY MappingId DESC LIMIT 1",
      [profile.UserId, PLATFORM_TENANT_ID]
    ).catch(() => [[]]);
    if (utmRows?.[0]?.TenantId) tenantId = utmRows[0].TenantId;
  }

  const universityStudent = isUniversityIdentity(profile);
  const tenant = universityStudent ? await loadTenantById(tenantId) : null;
  const provider = universityStudent ? await loadLmsProvider(profile.UserId, tenant) : null;
  const identity = identityFromUser(profile);

  return {
    profile,
    universityStudent,
    tenant,
    tenantId: tenant?.TenantId || (tenantId && String(tenantId) !== PLATFORM_TENANT_ID ? tenantId : null),
    provider,
    ...identity,
  };
}
