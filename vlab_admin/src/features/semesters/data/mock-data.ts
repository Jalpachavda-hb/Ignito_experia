import { faker } from '@faker-js/faker'
import { type Semester, type SemesterStatus } from './schema'

faker.seed(123)

const courseNames = [
  'Python Programming',
  'Java Development',
  'Linux Administration',
  'DBMS & SQL',
  'Data Science-I',
  'Big Data Analytics-I',
  'Software Testing Automation',
  'Agile Methodology',
  'Fundamental of Mobile Application',
  'Web Technology Using .NET',
  'Software Engineering'
]

const semesters = ['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4', 'Semester 5', 'Semester 6', 'Semester 7', 'Semester 8']

export const mockSemesters: Semester[] = Array.from({ length: 24 }, (_, i) => {
  const status = faker.helpers.weightedArrayElement([
    { weight: 2, value: 'upcoming' as SemesterStatus },
    { weight: 6, value: 'active' as SemesterStatus },
    { weight: 3, value: 'completed' as SemesterStatus },
  ])

  let startDate: Date
  let endDate: Date

  if (status === 'completed') {
    startDate = faker.date.past({ years: 1 })
    endDate = faker.date.recent({ days: 30 })
  } else if (status === 'active') {
    startDate = faker.date.recent({ days: 45 })
    endDate = faker.date.soon({ days: 90 })
  } else {
    startDate = faker.date.soon({ days: 30 })
    endDate = faker.date.future({ years: 0.5 })
  }

  return {
    id: faker.string.uuid(),
    name: semesters[i % semesters.length],
    courseId: faker.string.uuid(),
    courseName: faker.helpers.arrayElement(courseNames),
    startDate,
    endDate,
    studentsCount: faker.number.int({ min: 10, max: 200 }),
    labsAssigned: faker.number.int({ min: 1, max: 12 }),
    allocatedCredits: faker.number.int({ min: 5000, max: 25000 }),
    status,
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 15 }),
  }
})
