import pool from "../../lib/mysql.js";
import { unauthorized } from "../../lib/errors.js";
import {
  PLATFORM_TENANT_ID,
  isUniversityIdentity,
  loadLmsProvider,
  loadTenantById,
  resolvePortalTenant,
} from "../../lib/studentAccess.js";
import { cleanLmsId } from "./lmsIds.js";
import { lmsProfileCacheService } from "../LmsProfileCacheService.js";
import { lmsProgrammeService } from "./LmsProgrammeService.js";
import { mergeProgrammes } from "./programmeNormalize.js";

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
  if (!auth?.userId && !auth?.email) throw unauthorized("Authentication required");

  let profile = null;
  if (auth?.userId) {
    const [rows] = await pool.query("SELECT * FROM users WHERE UserId = ? LIMIT 1", [auth.userId]);
    profile = rows?.[0] || null;
  }
  if (!profile && auth?.email) {
    const [emailRows] = await pool.query(
      "SELECT * FROM users WHERE LOWER(TRIM(Email)) = LOWER(TRIM(?)) LIMIT 1",
      [auth.email]
    );
    profile = emailRows?.[0] || null;
  }
  if (!profile) throw unauthorized("User not found or inactive");

  let tenantId = profile.TenantId || auth.tenantId || null;
  if (!tenantId || String(tenantId).toUpperCase() === PLATFORM_TENANT_ID) {
    const [utmRows] = await pool.query(
      "SELECT TenantId FROM user_tenant_mapping WHERE UserId = ? AND Status = 'ACTIVE' AND TenantId <> 'PLATFORM' ORDER BY MappingId DESC LIMIT 1",
      [profile.UserId]
    ).catch(() => [[]]);
    if (utmRows?.[0]?.TenantId) tenantId = utmRows[0].TenantId;
  }

  const universityStudent = isUniversityIdentity(profile);
  const tenant = universityStudent
    ? (tenantId ? await loadTenantById(tenantId) : null) || (await resolvePortalTenant({ tenantId }))
    : null;
  const provider = universityStudent ? await loadLmsProvider(profile.UserId, tenant) : null;
  const identity = identityFromUser(profile);

  return {
    profile,
    universityStudent,
    tenant,
    tenantId: tenant?.TenantId || (tenantId && String(tenantId).toUpperCase() !== PLATFORM_TENANT_ID ? tenantId : null),
    provider,
    ...identity,
  };
}

export async function loadOwnedProgrammes(ctx) {
  if (!ctx?.universityStudent || !ctx?.tenant) {
    return { programmes: [], lmsStatus: null, profile: null, profileStatus: null };
  }

  let profile = null;
  let profileStatus = "LMS_PROFILE_UNAVAILABLE";
  if (ctx.admissionId || ctx.studentId) {
    const cached = await lmsProfileCacheService.getOrFetchProfile({
      tenantId: ctx.tenant.TenantId,
      provider: ctx.provider,
      externalStudentId: ctx.externalStudentId,
      admissionId: ctx.admissionId,
      studentId: ctx.studentId,
    });
    profileStatus = cached?.profileStatus || profileStatus;
    profile = cached?.data || null;
  }

  const purchased = ctx.studentId
    ? await lmsProgrammeService.getPurchased({
        tenantId: ctx.tenant.TenantId,
        provider: ctx.provider,
        studentId: ctx.studentId,
      })
    : null;

  const programmes = mergeProgrammes(
    Array.isArray(profile?.enrollmentnumberprogrammenamelist) ? profile.enrollmentnumberprogrammenamelist : [],
    purchased?.lmsStatus === "LIVE" ? (purchased.rawData || purchased) : null
  );
  const lmsStatus = profileStatus === "LIVE" || purchased?.lmsStatus === "LIVE"
    ? "LIVE"
    : (purchased?.lmsStatus || profileStatus);

  return { programmes, lmsStatus, profile, profileStatus, purchased };
}
