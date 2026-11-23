const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const defaultApiPort = import.meta.env.VITE_API_PORT || '8080';

let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

// Live sites (any non-local host) talk to the API on their own origin under /api, through
// nginx. A build-time localhost URL, or no URL at all, must not leak into production as
// http://<host>:8080/api. This keeps working when the live domain changes.
const isLocalHost = (hostname: string) =>
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

const apiBaseUrl = rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '';

export const APP_ENV = {
  apiBaseUrl,
  apiPort: defaultApiPort,
};

/** API server origin without the /api path (e.g. http://localhost:8080).   */
export const getApiOrigin = (): string => {
  if (APP_ENV.apiBaseUrl) {
    try {
      return new URL(APP_ENV.apiBaseUrl).origin;
    } catch {
      return APP_ENV.apiBaseUrl.replace(/\/api\/?$/, '');
    }
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:${APP_ENV.apiPort}`;
  }

  return '';
};

/** WebSocket origin for the API server (ws:// or wss://). */
export const getWsOrigin = (): string => {
  const origin = getApiOrigin();
  if (!origin) return '';

  try {
    const url = new URL(origin);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return url.origin;
  } catch {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    return `${protocol}://${origin.replace(/^https?:\/\//, '')}`;
  }
};

export const buildApiUrl = (path: string) => {
  if (!APP_ENV.apiBaseUrl) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  return `${APP_ENV.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};

/** Resolve a relative API path (e.g. /api/lab-sessions/...) against the configured API origin. */
export const resolveApiRelativeUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('http')) return url;

  const origin = getApiOrigin();
  if (!origin) return url;

  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
};
