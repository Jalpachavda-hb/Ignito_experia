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

export async function apiRequest(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<any> {
  const { headers, auth = true, ...restOptions } = options;

  const token = auth ? useAuthStore.getState().auth.accessToken : null;

  const response = await fetch(buildApiUrl(path), {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

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
