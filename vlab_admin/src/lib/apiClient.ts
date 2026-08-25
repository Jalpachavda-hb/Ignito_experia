import { executeRequest } from '@/Utils/GetApiHandler';
import { buildApiUrl } from '@/config/env';

export { buildApiUrl } from '@/config/env';

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

export async function apiRequest(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<any> {
  const { method = 'GET', body, headers, auth = true, signal } = options;
  return executeRequest(path, {
    method,
    body,
    headers: headers as any,
    auth,
    signal,
  });
}
