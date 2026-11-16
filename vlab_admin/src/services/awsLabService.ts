// AWS console labs API (docs/aws-console-labs.md §5.2).
// Never store the console sign-in URL anywhere persistent: it is a credential for 15 minutes.
import { executeRequest } from '../Utils/GetApiHandler'

export type AwsLabType = 'aws-ec2' | 'aws-s3' | 'aws-iam'
export type AwsLabStatus = 'READY' | 'ENDING' | 'ENDED' | 'ERROR'

export interface AwsLabTaskResult {
  id: string
  title: string
  passed: boolean
  message: string
}

export interface AwsLabValidation {
  score: number
  total: number
  tasks: AwsLabTaskResult[]
  checkedAt: number
}

export interface AwsLabSession {
  sessionId: string
  kind: 'aws-console'
  labType: AwsLabType
  title: string
  status: AwsLabStatus
  endReason: 'USER' | 'EXPIRED' | null
  region: string
  createdAt: number
  expiresAt: number
  serverTime: number
  bucketPrefix: string
  extensionsUsed: number
  canExtend: boolean
  extensionMinutes: number
  instructions: string | null
  tasks: { id: string; title: string }[]
  lastValidation: AwsLabValidation | null
}

export interface AwsApiError extends Error {
  status?: number
  payload?: { code?: string; sessionId?: string; retryAfterSeconds?: number; message?: string }
}

export const startAwsLab = (labType: string): Promise<AwsLabSession> =>
  executeRequest('/aws-labs/sessions', { method: 'POST', body: { labType }, auth: true })

export const getAwsLab = (sessionId: string): Promise<AwsLabSession> =>
  executeRequest(`/aws-labs/sessions/${encodeURIComponent(sessionId)}`, { auth: true })

export const createAwsConsoleUrl = (sessionId: string): Promise<{ url: string; linkExpiresAt: number }> =>
  executeRequest(`/aws-labs/sessions/${encodeURIComponent(sessionId)}/console-url`, { method: 'POST', body: {}, auth: true })

export const validateAwsLab = (sessionId: string): Promise<AwsLabValidation> =>
  executeRequest(`/aws-labs/sessions/${encodeURIComponent(sessionId)}/validate`, { method: 'POST', body: {}, auth: true })

export const extendAwsLab = (sessionId: string): Promise<AwsLabSession> =>
  executeRequest(`/aws-labs/sessions/${encodeURIComponent(sessionId)}/extend`, { method: 'POST', body: {}, auth: true })

export const endAwsLab = (sessionId: string): Promise<{ sessionId: string; status: AwsLabStatus }> =>
  executeRequest(`/aws-labs/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', auth: true })
