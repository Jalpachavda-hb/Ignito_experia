import pool from "./mysql.js";
import { badRequest, forbidden, unauthorized, notFound } from "./errors.js";
import { getSession } from "../services/sessionRepository.js";
import labSessionRepository from "../repositories/LabSessionRepository.js";

const PLATFORM_TENANTS = new Set(["", "DIRECT", "DEFAULT", "PLATFORM"]);

const concreteTenant = (value) => {
  const text = String(value ?? "").trim();
  if (PLATFORM_TENANTS.has(text.toUpperCase())) return null;
  return text;
};

const sameTenant = (left, right) => left.toLowerCase() === right.toLowerCase();

async function userOwnsRow(sessionUserId, auth) {
  if (sessionUserId == null || sessionUserId === "") return false;
  if (String(sessionUserId) === String(auth.userId) || String(sessionUserId) === String(auth.id || "")) {
    return true;
  }
  const rawAuthId = String(auth.userId || auth.id || "").trim();
  const isNum = /^\d+$/.test(rawAuthId);
  const numId = isNum ? parseInt(rawAuthId, 10) : -1;
  const lookupEmail = String(auth.email || "").trim().toLowerCase();
  try {
    const [rows] = await pool.query(
      `SELECT UserId FROM Users
       WHERE UserId = ?
         AND ((UserId = ? AND ? > 0) OR (LOWER(Email) = LOWER(?) AND ? != '') OR (ExternalStudentId = ? AND ? != ''))
       LIMIT 1`,
      [sessionUserId, numId, numId, lookupEmail, lookupEmail, rawAuthId, rawAuthId]
    );
    return Boolean(rows?.length);
  } catch (err) {
    console.warn("[sessionAccess] Ownership lookup failed:", err.message);
    return false;
  }
}

/**
 * File and terminal access.
 * MySQL lab_sessions owns TenantId and UserId for the lab.
 * The runtime session (DynamoDB, or memory when DynamoDB is unset) must
 * refer to that same session id.
 * Super Admin is the only cross-tenant exception.
 */
export const authorizeLabSession = async (auth, sessionId) => {
  if (!auth?.userId) throw unauthorized("Authentication required");
  if (!sessionId) throw badRequest("Session ID required");

  const session = await getSession(sessionId);
  const dbSession = await labSessionRepository.getSessionById(sessionId).catch(() => null);
  if (!session && !dbSession) throw notFound("Session not found");

  if (auth.role === "Super Admin") {
    return { session, dbSession };
  }

  const sessionUserId = dbSession?.UserId ?? session?.userId;
  const authTenant = concreteTenant(auth.tenantId || auth.universityId || auth.tenant_id);
  const sessionTenant = concreteTenant(dbSession?.TenantId || session?.tenantId);

  if (auth.role === "Tenant Admin") {
    if (!authTenant || !sessionTenant || !sameTenant(authTenant, sessionTenant)) {
      throw forbidden("Session belongs to another tenant");
    }
    return { session, dbSession };
  }

  const owns = await userOwnsRow(sessionUserId, auth);
  if (!owns) throw forbidden("You do not own this session");
  if (authTenant && sessionTenant && !sameTenant(authTenant, sessionTenant)) {
    throw forbidden("Session belongs to another tenant");
  }
  return { session, dbSession };
};
