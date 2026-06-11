import { faker } from '@faker-js/faker'
import { type Role, MODULES } from './schema'

faker.seed(12345)

const generateFullPermissions = () => {
  const perms: any = {}
  MODULES.forEach((mod) => {
    perms[mod] = { create: true, read: true, update: true, delete: true }
  })
  return perms
}

const generateReadOnlyPermissions = () => {
  const perms: any = {}
  MODULES.forEach((mod) => {
    perms[mod] = { create: false, read: true, update: false, delete: false }
  })
  return perms
}

const generateFacultyPermissions = () => {
  const perms = generateReadOnlyPermissions()
  // Faculty can manage courses, semesters, labs, and monitor sessions
  perms['Course Management'] = { create: true, read: true, update: true, delete: false }
  perms['Semester Management'] = { create: false, read: true, update: false, delete: false }
  perms['Lab Management'] = { create: true, read: true, update: true, delete: true }
  perms['Session Monitoring'] = { create: true, read: true, update: true, delete: false }
  return perms
}

const generateStudentPermissions = () => {
  const perms: any = {}
  MODULES.forEach((mod) => {
    perms[mod] = { create: false, read: false, update: false, delete: false }
  })
  perms['Lab Management'] = { create: true, read: true, update: false, delete: false }
  return perms
}

export const roles: Role[] = [
  {
    id: faker.string.uuid(),
    name: 'Super Admin',
    description: 'System administrator with full access to all features across the platform.',
    userCount: 2,
    permissions: generateFullPermissions(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  },

  {
    id: faker.string.uuid(),
    name: 'Faculty',
    description: 'Instructors who can manage labs, courses, and monitor their students.',
    userCount: 145,
    permissions: generateFacultyPermissions(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  },
  {
    id: faker.string.uuid(),
    name: 'Student',
    description: 'Standard end-user who can view assigned courses and launch lab environments.',
    userCount: 4200,
    permissions: generateStudentPermissions(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }
]
