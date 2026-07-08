import { getWsOrigin } from '@/config/env';
import { apiRequest } from '../lib/apiClient';

export interface TerminalConnection {
  sessionId: string;
  runId?: string;
  onMessage?: (data: any) => void;
}

export async function fetchFiles(sessionId: string) {
  return apiRequest('/files', {
    headers: { 'x-session-id': sessionId }
  });
}

export async function fetchFileContent(path: string, sessionId: string) {
  return apiRequest(`/files/content?path=${encodeURIComponent(path)}`, {
    headers: { 'x-session-id': sessionId }
  });
}

export async function saveFile(payload: any, sessionId: string) {
  return apiRequest('/save', {
    method: 'POST',
    headers: { 'x-session-id': sessionId },
    body: JSON.stringify(payload),
  });
}

export async function runFile(payload: any, sessionId: string) {
  const isDotnet =
    payload?.labType === 'dotnet' ||
    payload?.language === 'csharp' ||
    String(payload?.path || '').toLowerCase().endsWith('.cs');
  const isBuild = payload?.action === 'build';
  const controller = new AbortController();
  const timeoutMs = isDotnet ? (isBuild ? 360000 : 300000) : 60000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await apiRequest('/run', {
      method: 'POST',
      headers: { 'x-session-id': sessionId },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(
        isDotnet
          ? isBuild
            ? 'Build timed out after 6 minutes. Try BUILD again.'
            : 'Run timed out. Complete BUILD first, then try RUN again.'
          : 'Execution timed out. Try again.',
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function deleteFile(path: string, sessionId: string) {
  return apiRequest(`/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { 'x-session-id': sessionId },
  });
}

export function connectTerminalStream({ sessionId, runId, onMessage }: TerminalConnection): WebSocket {
  const wsOrigin = getWsOrigin();
  const socket = new WebSocket(`${wsOrigin}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}&runId=${encodeURIComponent(runId || '')}`);

  socket.onmessage = (event: MessageEvent) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      onMessage?.({ type: 'stdout', data: event.data });
    }
  };

  return socket;
}
