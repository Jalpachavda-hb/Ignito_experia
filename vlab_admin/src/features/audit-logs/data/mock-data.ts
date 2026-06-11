import { faker } from '@faker-js/faker'
import { type AuditLog, type AuditAction, type AuditModule } from './schema'

faker.seed(101112)

const actions: AuditAction[] = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'EXPORT']
const modules: AuditModule[] = ['Auth', 'Billing', 'Labs', 'Users', 'Roles', 'Programs', 'Courses', 'Semesters']

const generatePayload = (action: AuditAction, module: AuditModule) => {
  if (action === 'LOGIN_SUCCESS' || action === 'LOGIN_FAILED') {
    return {
      attemptId: faker.string.uuid(),
      method: 'password',
      mfa_enabled: faker.datatype.boolean()
    }
  }
  return {
    entityId: faker.string.uuid(),
    changes: {
      before: { status: 'draft' },
      after: { status: 'active' }
    },
    client_version: 'v1.4.2'
  }
}

const generateDescription = (action: AuditAction, module: AuditModule) => {
  switch (action) {
    case 'CREATE': return `Created new resource in ${module}`
    case 'UPDATE': return `Modified configuration for ${module}`
    case 'DELETE': return `Permanently deleted record in ${module}`
    case 'LOGIN_SUCCESS': return 'Successful authentication attempt'
    case 'LOGIN_FAILED': return 'Invalid credentials provided'
    case 'EXPORT': return `Exported ${module} data to CSV`
    default: return 'System event triggered'
  }
}

export const mockAuditLogs: AuditLog[] = Array.from({ length: 100 }, () => {
  const action = faker.helpers.arrayElement(actions)
  const module = faker.helpers.arrayElement(modules)
  
  return {
    id: faker.string.uuid(),
    timestamp: faker.date.recent({ days: 30 }),
    user: {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: faker.internet.email(),
    },
    action,
    module,
    description: generateDescription(action, module),
    ipAddress: faker.internet.ipv4(),
    userAgent: faker.internet.userAgent(),
    payload: generatePayload(action, module),
  }
}).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()) // Sort newest first
