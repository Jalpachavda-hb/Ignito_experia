const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

let rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';

if (
  typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  rawApiBaseUrl.includes('localhost')
) {
  rawApiBaseUrl = rawApiBaseUrl.replace('localhost', window.location.hostname);
}

if (typeof window !== 'undefined' && !rawApiBaseUrl) {
  rawApiBaseUrl = `${window.location.protocol}//${window.location.hostname}:8080/api`;
}

export const APP_ENV = {
  apiBaseUrl: rawApiBaseUrl ? trimTrailingSlash(rawApiBaseUrl) : '',
  appName: import.meta.env.VITE_APP_NAME || 'Vlab',
};

export const buildApiUrl = (path: string) => {
  if (!APP_ENV.apiBaseUrl) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  return `${APP_ENV.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
};
