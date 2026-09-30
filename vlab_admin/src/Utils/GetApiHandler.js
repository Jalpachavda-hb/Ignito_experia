import { useAuthStore } from '@/stores/auth-store';
import { BASE_URL, API_PATHS } from './Api_path';

export { BASE_URL, API_PATHS };

function readStoredToken(key) {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function currentAccessToken() {
  return useAuthStore.getState()?.auth?.accessToken || readStoredToken('auth-access-token') || '';
}

function currentRefreshToken() {
  const value = useAuthStore.getState()?.auth?.refreshToken || readStoredToken('auth-refresh-token') || '';
  return String(value).trim().replace(/^"|"$/g, '');
}

function currentLmsToken() {
  const value = useAuthStore.getState()?.auth?.lmsToken || readStoredToken('auth-lms-token') || '';
  return String(value).trim().replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '');
}

let refreshInFlight = null;

async function refreshSession(cleanBase) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const storedRefreshToken = currentRefreshToken();
    const refreshRes = await fetch(`${cleanBase}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(storedRefreshToken ? { 'X-Refresh-Token': storedRefreshToken } : {}),
      },
      body: JSON.stringify(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
    });

    if (!refreshRes.ok) return null;
    const refreshData = await refreshRes.json();
    const newToken = refreshData.accessToken;
    if (!newToken) return null;

    const authApi = useAuthStore.getState().auth;
    authApi.setAccessToken(newToken);
    if (refreshData.refreshToken) {
      authApi.setRefreshToken?.(refreshData.refreshToken);
    }
    if (refreshData.user) {
      authApi.setUser({
        ...refreshData.user,
        userId: refreshData.user.id || refreshData.user.userId,
        fullName: refreshData.user.fullName || refreshData.user.name,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
    }
    return newToken;
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function executeRequest(path, options = {}) {
  const { headers = {}, auth = true, method = 'GET', body, params, signal, baseUrl } = options;

  // Retrieve auth token and tenant directly from Zustand auth store
  const authState = useAuthStore.getState()?.auth;
  const token = auth ? currentAccessToken() : null;
  const lmsToken = currentLmsToken();
  const tenantId = authState?.user?.tenantId || authState?.user?.universityId;

  // Construct full URL using provided baseUrl or default BASE_URL from Api_path.js
  const activeBaseUrl = baseUrl || BASE_URL;
  const cleanBase = activeBaseUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  let fullUrl = `${cleanBase}${cleanPath}`;

  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const reqHeaders = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(lmsToken ? { 'X-Lms-Token': lmsToken } : {}),
    ...(tenantId ? { 'X-Tenant-Id': String(tenantId) } : {}),
    ...headers,
  };

  const fetchOptions = {
    method,
    headers: reqHeaders,
    credentials: 'include',
    ...(body ? { body: isFormData ? body : (typeof body === 'string' ? body : JSON.stringify(body)) } : {}),
    ...(signal ? { signal } : {}),
  };

  try {
    const response = await fetch(fullUrl, fetchOptions);

    // Auto Refresh token on 401 Unauthorized for authenticated routes
    if (response.status === 401 && auth && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
      try {
        const newToken = await refreshSession(cleanBase);
        if (newToken) {
          reqHeaders.Authorization = `Bearer ${newToken}`;
          const latestLmsToken = currentLmsToken();
          if (latestLmsToken) reqHeaders['X-Lms-Token'] = latestLmsToken;
          const retryResponse = await fetch(fullUrl, { ...fetchOptions, headers: reqHeaders });
          return await parseResponse(retryResponse);
        }
      } catch (refreshErr) {
        console.warn("Auto-refresh background attempt warning:", refreshErr);
        if (path.includes('/auth/me')) {
          useAuthStore.getState().auth.reset();
          if (typeof window !== 'undefined') {
            window.location.href = '/sign-in';
          }
        }
        throw refreshErr;
      }
    }

    return await parseResponse(response);
  } catch (err) {
    throw err;
  }
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message
      ? payload.message
      : `Request failed with status ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }

  return payload;
}

// GET API Handlers
export const fetchLabs = async () => {
  return executeRequest(API_PATHS.LABS.GET_LABS, { auth: true });
};

export const fetchSubLabs = async () => {
  return executeRequest(API_PATHS.LABS.GET_SUB_LABS, { auth: true });
};

export const fetchLabDetails = async (labId) => {
  return executeRequest(API_PATHS.LABS.GET_LAB_DETAILS(labId), { auth: true });
};

export const fetchLabSessionStatus = async (sessionId) => {
  return executeRequest(API_PATHS.LAB_SESSIONS.GET_SESSION_STATUS(sessionId), { auth: true });
};

export const fetchJupyterHealth = async (sessionId) => {
  return executeRequest(API_PATHS.LAB_SESSIONS.GET_JUPYTER_HEALTH(sessionId), { auth: true });
};

export const fetchUserActiveSession = async (userId, labId) => {
  const t = Date.now();
  const encoded = encodeURIComponent(userId);
  const path = API_PATHS.LAB_SESSIONS.GET_USER_ACTIVE_SESSION(encoded);
  return executeRequest(path, {
    params: { ...(labId ? { labId } : {}), t },
    auth: true,
  });
};

export const fetchFiles = async (sessionId) => {
  return executeRequest(API_PATHS.IDE.GET_FILES, {
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const fetchFileContent = async (path, sessionId) => {
  return executeRequest(API_PATHS.IDE.GET_FILE_CONTENT, {
    params: { path },
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const fetchAndroidBuildStatus = async (sessionId, offset) => {
  return executeRequest(API_PATHS.IDE.GET_ANDROID_BUILD_STATUS, {
    params: { sessionId, offset },
    headers: { 'x-session-id': sessionId },
    auth: true,
  });
};

export const fetchAuthMe = async () => {
  return executeRequest(API_PATHS.AUTH.ME, { auth: true });
};

export const fetchTenantResolve = async (domain, slug) => {
  return executeRequest(API_PATHS.TENANT.RESOLVE, {
    headers: domain ? { 'X-Tenant-Domain': domain } : {},
    params: slug ? { slug } : undefined,
    auth: false,
  });
};

export const fetchUsers = async (params) => {
  return executeRequest(API_PATHS.ADMIN.USERS, { params, auth: true });
};

export const fetchUserById = async (userId) => {
  return executeRequest(API_PATHS.ADMIN.USER_BY_ID(userId), { auth: true });
};

export const fetchStudentPrograms = async () => {
  return executeRequest('/student/programs', { auth: true });
};

export const fetchStudentSemesterCourses = async (programId, semesterId) => {
  return executeRequest(`/student/programs/${programId}/semesters/${semesterId}/courses`, { auth: true });
};

export const fetchRuntimeTypes = async () => {
  return executeRequest(API_PATHS.ADMIN.RUNTIME_TYPES, { auth: true });
};

export const fetchAdminLabs = async (params) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LABS, { params, auth: true });
};

export const fetchAdminLabById = async (labId) => {
  return executeRequest(API_PATHS.ADMIN.ADMIN_LAB_BY_ID(labId), { auth: true });
};

export const fetchAdminAuditLogs = async (params) => {
  return executeRequest(API_PATHS.ADMIN.AUDIT, { params, auth: true });
};

export const fetchAdminAuditStatistics = async () => {
  return executeRequest(API_PATHS.ADMIN.AUDIT_STATISTICS, { auth: true });
};
