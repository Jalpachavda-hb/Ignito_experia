import { faker } from '@faker-js/faker'
import { type Program, type ProgramDegree } from './schema'

faker.seed(456)

export const mockPrograms: Program[] = [
  {
    id: faker.string.uuid(),
    name: 'Master of Computer Applications',
    code: 'MCA',
    degree: 'Masters',
    durationYears: 2,
    totalCourses: 12,
    totalSemesters: 4,
    totalStudents: 150,
    totalLabs: 8,
    status: 'active',
    createdAt: faker.date.past({ years: 3 }),
    updatedAt: faker.date.recent(),
  },
  {
    id: faker.string.uuid(),
    name: 'Bachelor of Computer Applications',
    code: 'BCA',
    degree: 'Bachelors',
    durationYears: 3,
    totalCourses: 18,
    totalSemesters: 6,
    totalStudents: 450,
    totalLabs: 12,
    status: 'active',
    createdAt: faker.date.past({ years: 5 }),
    updatedAt: faker.date.recent(),
  },
  {
    id: faker.string.uuid(),
    name: 'Bachelor of Technology',
    code: 'B.Tech',
    degree: 'Bachelors',
    durationYears: 4,
    totalCourses: 32,
    totalSemesters: 8,
    totalStudents: 1200,
    totalLabs: 24,
    status: 'active',
    createdAt: faker.date.past({ years: 10 }),
    updatedAt: faker.date.recent(),
  },
  {
    id: faker.string.uuid(),
    name: 'Master of Technology',
    code: 'M.Tech',
    degree: 'Masters',
    durationYears: 2,
    totalCourses: 10,
    totalSemesters: 4,
    totalStudents: 80,
    totalLabs: 6,
    status: 'active',
    createdAt: faker.date.past({ years: 8 }),
    updatedAt: faker.date.recent(),
  }
]
