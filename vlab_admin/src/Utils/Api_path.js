const defaultApiPort = import.meta.env.VITE_API_PORT || '8080';

let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

if (
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  rawApiBaseUrl.includes('localhost')
) {
  rawApiBaseUrl = rawApiBaseUrl.replace('localhost', window.location.hostname);
}

if (typeof window !== 'undefined' && !rawApiBaseUrl) {
  rawApiBaseUrl = `${window.location.protocol}//${window.location.hostname}:${defaultApiPort}/api`;
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
