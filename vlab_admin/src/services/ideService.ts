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
  return apiRequest('/run', {
    method: 'POST',
    headers: { 'x-session-id': sessionId },
    body: JSON.stringify(payload),
  });
}

export async function deleteFile(path: string, sessionId: string) {
  return apiRequest(`/files?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
    headers: { 'x-session-id': sessionId },
  });
}

export function connectTerminalStream({ sessionId, runId, onMessage }: TerminalConnection): WebSocket {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use current window host (with port 8080) for websocket
  const host = `${window.location.hostname}:8080`; 
  const socket = new WebSocket(`${protocol}//${host}/ws/terminal?sessionId=${encodeURIComponent(sessionId)}&runId=${encodeURIComponent(runId || '')}`);

  socket.onmessage = (event: MessageEvent) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      onMessage?.({ type: 'stdout', data: event.data });
    }
  };

  return socket;
}
