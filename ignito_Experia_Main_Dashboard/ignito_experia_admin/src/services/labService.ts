import { api } from './api'

export async function sendLabHeartbeat(sessionId: string) {
  const response = await api.post(`/lab-sessions/${sessionId}/heartbeat`, {})
  return response.data
}
