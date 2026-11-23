const defaultApiPort = import.meta.env.VITE_API_PORT || '8080';

let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

// Live sites (any non-local host) talk to the API on their own origin under /api, through
// nginx. A build-time localhost URL, or no URL at all, must not leak into production as
// http://<host>:8080/api. This keeps working when the live domain changes.
const isLocalHost = (hostname) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);

if (typeof window !== 'undefined') {
  const { hostname, protocol, origin } = window.location;
  const configuredIsLocal = /\/\/(localhost|127\.0\.0\.1)([:/]|$)/.test(rawApiBaseUrl);
  if (!isLocalHost(hostname) && (!rawApiBaseUrl || configuredIsLocal)) {
    rawApiBaseUrl = `${origin}/api`;
  } else if (!rawApiBaseUrl) {
    rawApiBaseUrl = `${protocol}//${hostname}:${defaultApiPort}/api`;
  } else if (configuredIsLocal && hostname !== 'localhost') {
    rawApiBaseUrl = rawApiBaseUrl.replace('localhost', hostname);
  }
}

export const BASE_URL = rawApiBaseUrl
  ? rawApiBaseUrl.replace(/\/+$/, '')
  : 'http://localhost:8080/api';

export const API_PATHS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    ME: '/auth/me',
    SET_PASSWORD: '/auth/set-password',
    CHANGE_PASSWORD: '/user/change-password',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    SSO_LOGIN: '/auth/sso-login',
    UPDATE_PROFILE: '/user/profile',
    UPLOAD_PHOTO: '/user/profile-photo',
    UPLOAD: '/upload',
  },
  TENANT: {
    RESOLVE: '/tenant/resolve',
  },
  LABS: {
    GET_LABS: '/labs',
    GET_SUB_LABS: '/sub-labs',
    GET_LAB_DETAILS: (labId) => `/labs/${labId}`,
    UPDATE_CREDITS: (labId) => `/labs/${labId}/credits`,
  },
  LAB_SESSIONS: {
    START_SESSION: '/lab-sessions/start',
    GET_SESSION_STATUS: (sessionId) => `/lab-sessions/${sessionId}`,
    GET_JUPYTER_HEALTH: (sessionId) => `/lab-sessions/${sessionId}/jupyter-health`,
    GET_USER_ACTIVE_SESSION: (userId) => `/lab-sessions/active`,
    GET_ACTIVE_SESSION: '/lab-sessions/active',
    EXTEND_SESSION: (sessionId) => `/lab-sessions/${sessionId}/extend`,
    STOP_SESSION: (sessionId) => `/lab-sessions/${sessionId}/stop`,
    SWITCH_SUBTYPE: (sessionId) => `/lab-sessions/${sessionId}/switch-subtype`,
    HEARTBEAT: (sessionId) => `/lab-sessions/${sessionId}/heartbeat`,
    START_METRICS: (sessionId) => `/lab-sessions/${sessionId}/start-metrics`,
  },
  IDE: {
    GET_FILES: '/files',
    GET_FILE_CONTENT: '/files/content',
    SAVE_FILE: '/save',
    RUN_FILE: '/run',
    DELETE_FILE: '/files',
    START_ANDROID_BUILD: '/android/build',
    GET_ANDROID_BUILD_STATUS: '/android/build/status',
  },
  ADMIN: {
    USERS: '/users',
    USER_BY_ID: (userId) => `/users/${userId}`,
    USER_CREDITS: (userId) => `/users/${userId}/credits`,
    RUNTIME_TYPES: '/admin/runtime-types',
    ADMIN_LABS: '/admin/labs',
    ADMIN_LAB_BY_ID: (labId) => `/admin/labs/${labId}`,
    ADMIN_LAB_STATUS: (labId) => `/admin/labs/${labId}/status`,
    AUDIT: '/admin/audit',
    AUDIT_STATISTICS: '/admin/audit/statistics',
  },
  TOKENS: {
    STUDENT_SUMMARY: '/student/lab-tokens',
    STUDENT_LAB_ACCESS: '/student/labs/access',
    STUDENT_LAB_BALANCE: (labId) => `/student/labs/${labId}/tokens`,
    STUDENT_PACKAGES: '/student/lab-token-packages',
    STUDENT_USAGE: '/student/lab-token-usage',
    CREATE_ORDER: '/token-orders',
    VERIFY_PAYMENT: (orderId) => `/token-orders/${orderId}/verify-payment`,
    STUDENT_ORDERS: '/token-orders',
    OWNER_PACKAGES: '/owner/lab-token-packages',
    OWNER_PACKAGE_BY_ID: (id) => `/owner/lab-token-packages/${id}`,
    OWNER_PACKAGE_STATUS: (id) => `/owner/lab-token-packages/${id}/status`,
  },
};
