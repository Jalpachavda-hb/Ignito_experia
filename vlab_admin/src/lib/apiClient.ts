import { useAuthStore } from '@/stores/auth-store';

export class ApiError extends Error {
  status: number;
  payload: any;

  constructor(message: string, status: number, payload: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function buildApiUrl(path: string): string {
  const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || `${window.location.protocol}//${window.location.hostname}:8080/api`;
  const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');
  const baseUrl = trimTrailingSlash(rawApiBaseUrl);
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

let isRefreshing = false;
let failedQueue: { resolve: (token: string) => void; reject: (err: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

export async function apiRequest(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<any> {
  const { headers, auth = true, ...restOptions } = options;

  const token = auth ? useAuthStore.getState().auth.accessToken : null;

  const fetchOptions: RequestInit = {
    ...restOptions,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  };

  try {
    const response = await fetch(buildApiUrl(path), fetchOptions);

    if (response.status === 401 && auth && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (newToken: string) => {
              const newOptions = {
                ...fetchOptions,
                headers: {
                  ...fetchOptions.headers,
                  Authorization: `Bearer ${newToken}`,
                },
              };
              resolve(fetch(buildApiUrl(path), newOptions).then(res => handleResponse(res)));
            },
            reject: (err: any) => {
              reject(err);
            },
          });
        });
      }

      isRefreshing = true;

      try {
        const refreshResponse = await fetch(buildApiUrl('/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!refreshResponse.ok) {
          throw new Error('Refresh token expired or invalid');
        }

        const refreshData = await refreshResponse.json();
        const newAccessToken = refreshData.accessToken;

        useAuthStore.getState().auth.setAccessToken(newAccessToken);
        if (refreshData.user) {
          useAuthStore.getState().auth.setUser({
            userId: refreshData.user.id,
            fullName: refreshData.user.name,
            email: refreshData.user.email,
            role: refreshData.user.role,
            roleId: refreshData.user.roleId,
            status: refreshData.user.status,
            programId: refreshData.user.programId,
            semesterId: refreshData.user.semesterId,
            permissions: refreshData.user.permissions,
            exp: Date.now() + 24 * 60 * 60 * 1000,
          });
        }

        isRefreshing = false;
        processQueue(null, newAccessToken);

        const newOptions = {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            Authorization: `Bearer ${newAccessToken}`,
          },
        };
        const retryRes = await fetch(buildApiUrl(path), newOptions);
        return await handleResponse(retryRes);
      } catch (refreshErr) {
        isRefreshing = false;
        processQueue(refreshErr, null);
        useAuthStore.getState().auth.reset();
        window.location.href = '/sign-in';
        throw refreshErr;
      }
    }

    return await handleResponse(response);
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    throw new ApiError(err.message || 'Network request failed', 500, null);
  }
}

async function handleResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message
      ? payload.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

