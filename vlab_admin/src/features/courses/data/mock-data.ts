import { faker } from '@faker-js/faker'
import { type Course, type CourseProgram, type CourseStatus } from './schema'

faker.seed(88)

const programs: CourseProgram[] = [
  'MCA',
  'BCA',
  'Computer Science',
  'Cyber Security',
  'Data Science',
  'Cloud Computing',
  'Software Engineering'
]

const realisticCourses = [
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

export const mockCourses: Course[] = realisticCourses.map((name, index) => {
  const program = index % 2 === 0 ? 'MCA' : 'BCA'
  const status: CourseStatus = 'active'

  return {
    id: faker.string.uuid(),
    code: `${program.substring(0, 3).toUpperCase()}${faker.number.int({ min: 100, max: 499 })}`,
    name,
    program,
    totalSemesters: 8,
    studentsCount: faker.number.int({ min: 10, max: 250 }),
    labsAssigned: faker.number.int({ min: 1, max: 5 }),
    status,
    description: faker.lorem.paragraph(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),
  }
})

// Generate some more dummy courses to fill the list, total 30
const additionalCourses: Course[] = Array.from({ length: 19 }, () => {
  const program = faker.helpers.arrayElement(programs)
  const status = faker.helpers.weightedArrayElement([
    { weight: 7, value: 'active' as CourseStatus },
    { weight: 2, value: 'draft' as CourseStatus },
    { weight: 1, value: 'archived' as CourseStatus },
  ])

  return {
    id: faker.string.uuid(),
    code: `${program.substring(0, 3).toUpperCase()}${faker.number.int({ min: 100, max: 499 })}`,
    name: faker.company.catchPhrase() + ' ' + faker.helpers.arrayElement(['Fundamentals', 'Advanced', 'Practicum', 'Theory']),
    program,
    totalSemesters: faker.helpers.arrayElement([2, 4, 6, 8]),
    studentsCount: status === 'active' ? faker.number.int({ min: 10, max: 250 }) : 0,
    labsAssigned: faker.number.int({ min: 0, max: 12 }),
    status,
    description: faker.lorem.paragraph(),
    createdAt: faker.date.past({ years: 2 }),
    updatedAt: faker.date.recent({ days: 30 }),
  }
})

mockCourses.push(...additionalCourses)

// Mock details page data
export const mockCourseAnalytics = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    activeStudents: faker.number.int({ min: 20, max: 150 }),
    labHoursConsumed: faker.number.int({ min: 40, max: 300 }),
  }
})
