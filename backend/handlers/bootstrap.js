import { ok } from "../lib/apigw.js";
import { unauthorized } from "../lib/errors.js";
import pool from "../lib/mysql.js";
import { permissionService } from "../services/PermissionService.js";
import { navigationService } from "../services/NavigationService.js";
import studentProfileRepository from "../repositories/StudentProfileRepository.js";
import userRepository from "../repositories/UserRepository.js";

/**
 * GET /app/bootstrap
 * Master initialization endpoint. Returns User Profile, Roles, 
 * RBAC Matrix, Navigation, and System Settings in one payload.
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
  let profile = null;
  let roleCode = auth.role ? String(auth.role).toUpperCase().replace(/\s+/g, '_') : null;

  if (roleCode === 'STUDENT') {
    profile = await studentProfileRepository.findById(auth.userId);
  } else {
    profile = await userRepository.findById(auth.userId);
  }

  if (!profile || profile.Status !== 'Active') {
    throw unauthorized("User account is inactive or not found.");
  }

  // 3. Resolve RBAC Permission Matrix
  // If SuperAdmin, we inject a massive array of ALL permissions or pass a flag
  let matrix = { userAllow: [], userDeny: [], roleAllow: [] };
  let permissionsFlat = [];
  
  if (roleCode === 'SUPER_ADMIN') {
    const [allPerms] = await pool.query("SELECT PermissionCode FROM Permissions_V2");
    permissionsFlat = allPerms.map(p => p.PermissionCode);
    matrix.roleAllow = permissionsFlat;
  } else {
    matrix = await permissionService.getUserPermissionMatrix(auth.userId, roleCode);
    const pSet = new Set(matrix.roleAllow);
    for (const p of matrix.userAllow) pSet.add(p);
    for (const p of matrix.userDeny) pSet.delete(p);
    permissionsFlat = Array.from(pSet);
  }

  // 4. Generate Navigation
  const navigation = await navigationService.buildNavigation(matrix, profile.UniversityId);

  // 5. Fetch Settings and Flags
  const settings = await navigationService.getApplicationSettings();
  const flags = {
    VIRTUAL_LABS: true,
    COMPILER: true,
    REPORTS: true,
    CONTAINER_MONITORING: false
  };

  // 6. Return Monolithic Payload
  return ok({
    success: true,
    user: {
      id: profile.UserId || profile.StudentProfileId,
      fullName: profile.FullName || `${profile.FirstName} ${profile.LastName}`,
      email: profile.Email,
      role: profile.Role || 'Student',
      roleCode: roleCode,
      status: profile.Status,
      universityId: profile.UniversityId,
      departmentId: profile.DepartmentId,
    },
    permissions: permissionsFlat,
    navigation,
    settings,
    featureFlags: flags
  });
};
