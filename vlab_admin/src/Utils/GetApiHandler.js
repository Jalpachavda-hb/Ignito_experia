import { useAuthStore } from '@/stores/auth-store';
import { BASE_URL, API_PATHS } from './Api_path';

export { BASE_URL, API_PATHS };

export async function executeRequest(path, options = {}) {
  const { headers = {}, auth = true, method = 'GET', body, params, signal, baseUrl } = options;

  // Retrieve auth token directly from Zustand auth store
  const token = auth ? useAuthStore.getState()?.auth?.accessToken : null;

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

  const reqHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const fetchOptions = {
    method,
    headers: reqHeaders,
    credentials: 'include',
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    ...(signal ? { signal } : {}),
  };

  try {
    const response = await fetch(fullUrl, fetchOptions);

    // Auto Refresh token on 401 Unauthorized for authenticated routes
    if (response.status === 401 && auth && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
      try {
        const refreshRes = await fetch(`${cleanBase}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newToken = refreshData.accessToken;
          if (newToken) {
            useAuthStore.getState().auth.setAccessToken(newToken);
            if (refreshData.user) {
              useAuthStore.getState().auth.setUser({
                ...refreshData.user,
                userId: refreshData.user.id || refreshData.user.userId,
                fullName: refreshData.user.fullName || refreshData.user.name,
                exp: Date.now() + 24 * 60 * 60 * 1000,
              });
            }
            reqHeaders.Authorization = `Bearer ${newToken}`;
            const retryResponse = await fetch(fullUrl, { ...fetchOptions, headers: reqHeaders });
            return await parseResponse(retryResponse);
          }
        }
      } catch (refreshErr) {
        useAuthStore.getState().auth.reset();
        if (typeof window !== 'undefined') {
          window.location.href = '/sign-in';
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

export const fetchTenantResolve = async (domain) => {
  return executeRequest(API_PATHS.TENANT.RESOLVE, {
    headers: domain ? { 'X-Tenant-Domain': domain } : {},
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
