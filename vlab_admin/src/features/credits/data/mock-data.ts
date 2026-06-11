import { faker } from '@faker-js/faker'
import { type Wallet, type Transaction } from './schema'

faker.seed(999)

export const mockWallets: Wallet[] = Array.from({ length: 50 }, () => {
  const isStudent = faker.datatype.boolean()
  const used = faker.number.int({ min: 0, max: 2000 })
  const balance = faker.number.int({ min: 100, max: 5000 })
  
  return {
    userId: faker.string.uuid(),
    userName: faker.person.fullName(),
    role: isStudent ? 'student' : 'faculty',
    course: isStudent ? faker.helpers.arrayElement(['CS', 'CYB', 'DS', 'CC']) : undefined,
    semester: isStudent ? faker.helpers.arrayElement(['F24', 'S25', 'SU25']) : undefined,
    balance,
    usedCredits: used,
    lastUpdated: faker.date.recent({ days: 10 }),
  }
})

export const mockTransactions: Transaction[] = Array.from({ length: 150 }, () => {
  const type = faker.helpers.arrayElement(['allocation', 'consumption'] as const)
  const amount = type === 'allocation' ? faker.number.int({ min: 100, max: 5000 }) : -faker.number.int({ min: 10, max: 500 })
  const user = faker.helpers.arrayElement(mockWallets)

  return {
    id: faker.string.uuid(),
    date: faker.date.recent({ days: 30 }),
    userId: user.userId,
    userName: user.userName,
    amount,
    type,
    admin: type === 'allocation' ? 'Super Admin' : undefined,
    reason: type === 'allocation' 
      ? faker.helpers.arrayElement(['Semester Grant', 'Course Requirement', 'Bonus Allocation']) 
      : faker.helpers.arrayElement(['Ubuntu Server Session', 'Kali Linux Base', 'Windows Datacenter', 'Database Lab']),
  }
}).sort((a, b) => b.date.getTime() - a.date.getTime())

// Generate some trend data for charts
export const usageTrendData = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() - (13 - i))
  return {
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    consumed: faker.number.int({ min: 1000, max: 5000 }),
    allocated: faker.number.int({ min: 0, max: 8000 }),
  }
})

export const distributionData = [
  { name: 'CS', value: 45000, fill: '#3b82f6' }, // blue-500
  { name: 'CYB', value: 32000, fill: '#f59e0b' }, // amber-500
  { name: 'DS', value: 28000, fill: '#10b981' }, // emerald-500
  { name: 'CC', value: 15000, fill: '#8b5cf6' }, // violet-500
]
