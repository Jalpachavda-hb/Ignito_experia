import { getWsOrigin } from '@/config/env';
import {
  fetchFiles,
  fetchFileContent,
  fetchAndroidBuildStatus,
} from '../Utils/GetApiHandler';
import {
  saveFile,
  runFile as runFileApi,
  deleteFile,
  startAndroidBuild,
} from '../Utils/PostApiHandler';

export interface TerminalConnection {
  sessionId: string;
  runId?: string;
  onMessage?: (data: any) => void;
}

export {
  fetchFiles,
  fetchFileContent,
  saveFile,
  deleteFile,
  startAndroidBuild,
  fetchAndroidBuildStatus,
};

export async function runFile(payload: any, sessionId: string) {
  const isDotnet =
    payload?.labType === 'dotnet' ||
    payload?.language === 'csharp' ||
    String(payload?.path || '').toLowerCase().endsWith('.cs');
  const isAndroid =
    payload?.labType === 'android' ||
    String(payload?.path || '').toLowerCase().includes('build.sh');
  const isBuild = payload?.action === 'build' || payload?.path?.includes('build');
  const controller = new AbortController();
  const timeoutMs = isDotnet || isAndroid ? (isBuild ? 360000 : 300000) : 60000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await runFileApi(payload, sessionId, {
      signal: controller.signal,
      timeout: timeoutMs,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.code === 'ECONNABORTED') {
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


