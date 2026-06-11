import { faker } from '@faker-js/faker'

faker.seed(789)

// Chart 1: Credit Consumption (Area Chart - Last 14 days)
export const mockCreditConsumption = Array.from({ length: 14 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - (13 - i))
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    consumed: faker.number.int({ min: 100, max: 800 }),
    allocated: faker.number.int({ min: 600, max: 1000 }),
  }
})

// Chart 2: Lab Usage (Bar Chart)
export const mockLabUsage = [
  { name: 'Kali Linux', hours: 450, uniqueUsers: 120 },
  { name: 'Ubuntu Base', hours: 320, uniqueUsers: 85 },
  { name: 'Windows Server', hours: 210, uniqueUsers: 45 },
  { name: 'Docker Host', hours: 190, uniqueUsers: 50 },
  { name: 'Data Science', hours: 150, uniqueUsers: 30 },
]

// Chart 3: Active Users (Line Chart - Last 24 Hours)
export const mockActiveUsers = Array.from({ length: 24 }, (_, i) => {
  return {
    time: `${i}:00`,
    users: faker.number.int({ min: 5, max: 150 }),
  }
})

// Tabular Reports Mock Data
export const mockStudentReports = Array.from({ length: 50 }, () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  course: faker.helpers.arrayElement(['B.Tech', 'MCA', 'BCA']),
  semester: faker.helpers.arrayElement(['Fall 2026', 'Spring 2026']),
  creditsUsed: faker.number.int({ min: 10, max: 500 }),
  labHours: faker.number.float({ min: 1, max: 50, multipleOf: 0.1 }),
}))

export const mockCourseReports = Array.from({ length: 15 }, () => ({
  id: faker.string.uuid(),
  courseName: faker.helpers.arrayElement(['CS101', 'CYB400', 'DS200']),
  program: faker.helpers.arrayElement(['B.Tech', 'MCA', 'BCA']),
  totalStudents: faker.number.int({ min: 20, max: 200 }),
  activeLabs: faker.number.int({ min: 1, max: 15 }),
  totalCreditBurn: faker.number.int({ min: 1000, max: 15000 }),
}))
