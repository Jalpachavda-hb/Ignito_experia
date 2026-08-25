import { executeRequest } from './GetApiHandler';
import { API_PATHS } from './Api_path';

// POST / PUT / PATCH / DELETE API Handlers

export const loginWithCredentials = async ({ email, password, slug }) => {
  return executeRequest(API_PATHS.AUTH.LOGIN, {
    method: 'POST',
    body: { email, password, slug },
    auth: false,
  });
};

export const registerWithCredentials = async (payload) => {
  return executeRequest(API_PATHS.AUTH.REGISTER, {
    method: 'POST',
    body: payload,
    auth: false,
  });
};

export const logoutUser = async () => {
  return executeRequest(API_PATHS.AUTH.LOGOUT, {
    method: 'POST',
    auth: false,
  });
};

export const setPassword = async (payload) => {
  return executeRequest(API_PATHS.AUTH.SET_PASSWORD, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const changePassword = async (payload) => {
  return executeRequest(API_PATHS.AUTH.CHANGE_PASSWORD, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const forgotPassword = async (payload) => {
  return executeRequest(API_PATHS.AUTH.FORGOT_PASSWORD, {
    method: 'POST',
    body: payload,
    auth: false,
  });
};

export const resetPassword = async (payload) => {
  return executeRequest(API_PATHS.AUTH.RESET_PASSWORD, {
    method: 'POST',
    body: payload,
    auth: false,
  });
};

export const ssoLogin = async (payload, token) => {
  return executeRequest(API_PATHS.AUTH.SSO_LOGIN, {
    method: 'POST',
    body: payload,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    auth: false,
  });
};

export const updateUserProfile = async (payload) => {
  return executeRequest(API_PATHS.AUTH.UPDATE_PROFILE, {
    method: 'PUT',
    body: payload,
    auth: true,
  });
};

export const uploadProfilePhoto = async (formData) => {
  return executeRequest(API_PATHS.AUTH.UPLOAD_PHOTO, {
    method: 'POST',
    body: formData,
    auth: true,
  });
};

export {
  refreshStudentProfile,
  getStudentProfile,
  getStudentPurchasedProgrammes,
  getSemesterCourseListByProgrammeId,
  getPracticalAvailablePrograms
} from './lmsApi_paths';

/**
 * @param {{ labId: string, sessionBlocks?: number, duration?: number, dotnetSubtype?: string, idempotencyKey?: string, userCredits?: number }} params
 */
export const startLabSession = async ({ labId, sessionBlocks = 1, duration, dotnetSubtype, idempotencyKey, userCredits } = {}) => {
  if (!labId) {
    throw new Error('labId is required to start a lab session');
  }
  return executeRequest(API_PATHS.LAB_SESSIONS.START_SESSION, {
    method: 'POST',
    body: {
      labId,
      sessionBlocks,
      ...(duration ? { duration } : {}),
      ...(dotnetSubtype ? { dotnetSubtype } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      ...(typeof userCredits === 'number' ? { userCredits } : {})
    },
    auth: true,
  });
};

/**
 * @param {string} sessionId
 * @param {{ sessionBlocks?: number, idempotencyKey?: string }} [options]
 */
export const extendLabSession = async (sessionId, { sessionBlocks = 1, idempotencyKey } = {}) => {
  if (!sessionId) {
    throw new Error('sessionId is required to extend a lab session');
  }
  return executeRequest(API_PATHS.LAB_SESSIONS.EXTEND_SESSION(sessionId), {
    method: 'POST',
    body: {
      sessionBlocks,
      ...(idempotencyKey ? { idempotencyKey } : {})
    },
    auth: true,
  });
};

export const stopLabSession = async (sessionId) => {
  return executeRequest(API_PATHS.LAB_SESSIONS.STOP_SESSION(sessionId), {
    method: 'POST',
    body: { sessionId },
    auth: true,
  });
};

export const updateLabCredits = async (labId, credits) => {
  return executeRequest(API_PATHS.LABS.UPDATE_CREDITS(labId), {
    method: 'PATCH',
    body: { credits },
    auth: true,
  });
};

export const saveFile = async (payload, sessionId) => {
  return executeRequest(API_PATHS.IDE.SAVE_FILE, {
    method: 'POST',
    body: payload,
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const runFile = async (payload, sessionId, config = {}) => {
  return executeRequest(API_PATHS.IDE.RUN_FILE, {
    method: 'POST',
    body: payload,
    headers: { 'x-session-id': sessionId },
    signal: config.signal,
    auth: true,
  });
};

export const deleteFile = async (path, sessionId) => {
  return executeRequest(API_PATHS.IDE.DELETE_FILE, {
    method: 'DELETE',
    params: { path },
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const startAndroidBuild = async (sessionId) => {
  return executeRequest(API_PATHS.IDE.START_ANDROID_BUILD, {
    method: 'POST',
    body: { sessionId, projectPath: '/workspace' },
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const createUser = async (payload) => {
  return executeRequest(API_PATHS.ADMIN.USERS, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const updateUser = async (userId, payload) => {
  return executeRequest(API_PATHS.ADMIN.USER_BY_ID(userId), {
    method: 'PUT',
    body: payload,
    auth: true,
  });
};

export const deleteUser = async (userId) => {
  return executeRequest(API_PATHS.ADMIN.USER_BY_ID(userId), {
    method: 'DELETE',
    auth: true,
  });
};

export const updateUserCredits = async (userId, credits) => {
  return executeRequest(API_PATHS.ADMIN.USER_CREDITS(userId), {
    method: 'PATCH',
    body: { credits },
    auth: true,
  });
};

export const createAdminLab = async (payload) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LABS, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};

export const updateAdminLab = async (labId, payload) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LAB_BY_ID(labId), {
    method: 'PUT',
    body: payload,
    auth: true,
  });
};

export const deleteAdminLab = async (labId) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LAB_BY_ID(labId), {
    method: 'DELETE',
    auth: true,
  });
};

export const updateAdminLabStatus = async (labId, status) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LAB_STATUS(labId), {
    method: 'PATCH',
    body: { status },
    auth: true,
  });
};

export const mapCourseLab = async (courseId, payload) => {
  return executeRequest(`/admin/courses/${encodeURIComponent(courseId)}/map-lab`, {
    method: 'POST',
    body: payload,
    auth: true,
  });
};
