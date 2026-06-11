import { faker } from '@faker-js/faker'
import { type Session } from './schema'

faker.seed(42)

const realisticLabs = [
  'Python Programming Lab',
  'Java Development Lab',
  'Linux Administration Lab',
  'DBMS & SQL Lab',
  'Data Science-I',
  'Big Data Analytics-I',
  'Software Testing Automation',
  'Agile Methodology',
  'Fundamental of Mobile Application',
  'Web Technology Using .NET',
  'Software Engineering'
]

export const mockSessions: Session[] = Array.from({ length: 60 }, () => {
  const status = faker.helpers.weightedArrayElement([
    { weight: 6, value: 'running' as const },
    { weight: 3, value: 'stopped' as const },
    { weight: 1, value: 'failed' as const },  
  ])

  const isRunning = status === 'running'
  
  // CPU is highly volatile in labs.
  // Stopped/failed sessions have 0 usage.
  let cpuUsage = 0
  let ramUsage = 0
  
  if (isRunning) {
    // Some labs are idle, some are maxing out (crypto mining maybe?)
    cpuUsage = faker.helpers.weightedArrayElement([
      { weight: 5, value: faker.number.int({ min: 1, max: 20 }) },
      { weight: 3, value: faker.number.int({ min: 30, max: 70 }) },
      { weight: 1, value: faker.number.int({ min: 85, max: 100 }) },
    ])
    ramUsage = faker.number.int({ min: 10, max: 95 })
  }

  const startTime = faker.date.recent({ days: 2 })
  const endTime = isRunning ? null : faker.date.between({ from: startTime, to: new Date() })

  return {
    id: faker.string.uuid(),
    userId: faker.string.uuid(),
    userName: faker.person.fullName(),
    userEmail: faker.internet.email(),
    labName: faker.helpers.arrayElement(realisticLabs),
    course: faker.helpers.arrayElement(['MCA', 'BCA']),
    startTime,
    endTime,
    status,
    cpuUsage,
    ramUsage,
  }
}).sort((a, b) => b.startTime.getTime() - a.startTime.getTime())

// Generate some timeline data for charts (e.g. sessions launched per hour today)
export const timelineData = Array.from({ length: 24 }, (_, i) => {
  return {
    hour: `${i.toString().padStart(2, '0')}:00`,
    launches: faker.number.int({ min: 0, max: i > 8 && i < 18 ? 45 : 10 }), // peak during day
  }
})
