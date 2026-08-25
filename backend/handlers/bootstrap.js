import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import { navigationService } from "../services/NavigationService.js";
import userRepository from "../repositories/UserRepository.js";
import { ROLES } from "../constants/roles.js";

/**
 * GET /app/bootstrap
 * Master initialization endpoint. Returns User Profile, Navigation, and System Settings in one payload.
 */
export const appBootstrapHandler = async ({ auth }) => {
  if (!auth) {
    throw unauthorized("Not authenticated");
  }

  // 1. Validate Session Active State
  if (auth.sessionId) {
    const [sessions] = await pool.query(
      "SELECT Status FROM StudentSessions WHERE SessionId = ?",
      [auth.sessionId]
    );
    if (!sessions.length || sessions[0].Status !== 'ACTIVE') {
      throw unauthorized("Session has expired or was revoked.");
    }
  }

  // 2. Fetch User Profile
  const profile = await userRepository.findById(auth.userId);

  if (!profile || profile.Status !== 'Active') {
    throw unauthorized("User account is inactive or not found.");
  }

  const rawRole = (profile.Role || auth.role || "STUDENT").toUpperCase().replace(/\s+/g, "_");
  const normalizedRole = ["TENANT_ADMIN", "TENANTADMIN", "SUPER_ADMIN", "SUPERADMIN", "ADMIN"].includes(rawRole)
    ? ROLES.TENANT_ADMIN
    : ROLES.STUDENT;

  // 3. Generate Role-based Navigation
  const navigation = await navigationService.buildNavigation(normalizedRole, profile.UniversityId);

  // 4. Fetch Settings and Flags
  const settings = await navigationService.getApplicationSettings();
  const flags = {
    VIRTUAL_LABS: true,
    COMPILER: true,
    REPORTS: true,
    CONTAINER_MONITORING: false
  };

  // 5. Return Clean Monolithic Payload
  return ok({
    success: true,
    user: {
      id: profile.UserId,
      userId: profile.UserId,
      fullName: profile.FullName || profile.Name || 'User',
      email: profile.Email,
      role: normalizedRole,
      status: profile.Status,
      universityId: profile.UniversityId || profile.TenantId,
    },
    navigation,
    settings,
    featureFlags: flags
  });
};
