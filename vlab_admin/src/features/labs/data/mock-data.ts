import { faker } from '@faker-js/faker'
import { type Lab, type LabCategory, type LabStatus } from './schema'

faker.seed(777)

const categories: LabCategory[] = ['Security', 'Networking', 'Development', 'Data Science', 'Cloud Computing']
const statuses: LabStatus[] = ['active', 'maintenance', 'deprecated']

const techPool = ['Linux', 'Windows', 'Docker', 'Python', 'Go', 'React', 'Node.js', 'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'Wireshark', 'Metasploit', 'Kubernetes']

const realisticLabs = [
  { name: 'Python Programming Lab', durationMinutes: 90, creditCost: 30 },
  { name: 'Java Development Lab', durationMinutes: 120, creditCost: 40 },
  { name: 'Linux Administration Lab', durationMinutes: 60, creditCost: 25 },
  { name: 'DBMS & SQL Lab', durationMinutes: 75, creditCost: 35 },
  { name: 'Data Science-I', durationMinutes: 120, creditCost: 50 },
  { name: 'Big Data Analytics-I', durationMinutes: 150, creditCost: 60 },
  { name: 'Software Testing Automation', durationMinutes: 90, creditCost: 35 },
  { name: 'Agile Methodology', durationMinutes: 60, creditCost: 20 },
  { name: 'Fundamental of Mobile Application', durationMinutes: 120, creditCost: 45 },
  { name: 'Web Technology Using .NET', durationMinutes: 100, creditCost: 40 },
  { name: 'Software Engineering', durationMinutes: 90, creditCost: 30 }
]

export const mockLabs: Lab[] = realisticLabs.map((labData) => {
  const category = faker.helpers.arrayElement(categories)
  const status: LabStatus = 'active'
  
  // Pick 2 to 4 random technologies
  const shuffledTech = [...techPool].sort(() => 0.5 - Math.random())
  const technologies = shuffledTech.slice(0, faker.number.int({ min: 2, max: 4 }))

  return {
    id: faker.string.uuid(),
    title: labData.name,
    subtitle: faker.lorem.sentence(),
    program: faker.helpers.arrayElement(['Computer Science', 'Cyber Security', 'Data Science', 'Cloud Computing']),
    semester: faker.helpers.arrayElement(['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4']),
    logoUrl: '/images/logo.png',
    category,
    credits: labData.creditCost,
    durationMinutes: labData.durationMinutes,
    complexity: faker.helpers.arrayElement(['Beginner', 'Intermediate', 'Advanced']),
    runtimeType: faker.helpers.arrayElement(['ide', 'terminal', 'jupyter', 'codeserver']),
    runtimePort: 8080,
    runtimePath: '/',
    containerApiPath: '/api',
    taskDefinition: faker.helpers.arrayElement(['vlab-dev-android-task', 'vlab-dev-linux-task', 'vlab-dev-python-task']),
    instructions: '# Lab Instructions\n\n1. Start the container.\n2. SSH into the terminal.\n3. Execute the payload.',
    status,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 15 }),
  }
})

// Add more fake labs to have a good number
const additionalLabs: Lab[] = Array.from({ length: 31 }, () => {
  const category = faker.helpers.arrayElement(categories)
  const status = faker.helpers.arrayElement(statuses)
  
  // Pick 2 to 4 random technologies
  const shuffledTech = [...techPool].sort(() => 0.5 - Math.random())
  const technologies = shuffledTech.slice(0, faker.number.int({ min: 2, max: 4 }))

  return {
    id: faker.string.uuid(),
    title: faker.commerce.productName() + ' Lab',
    subtitle: faker.lorem.sentence(),
    program: faker.helpers.arrayElement(['Computer Science', 'Cyber Security', 'Data Science', 'Cloud Computing']),
    semester: faker.helpers.arrayElement(['Semester 1', 'Semester 2', 'Semester 3', 'Semester 4']),
    logoUrl: '/images/logo.png',
    category,
    credits: faker.number.int({ min: 5, max: 150 }) * 10,
    durationMinutes: faker.helpers.arrayElement([60, 120, 180, 240, 480]),
    complexity: faker.helpers.arrayElement(['Beginner', 'Intermediate', 'Advanced']),
    runtimeType: faker.helpers.arrayElement(['ide', 'terminal', 'jupyter', 'codeserver']),
    runtimePort: 8080,
    runtimePath: '/',
    containerApiPath: '/api',
    taskDefinition: faker.helpers.arrayElement(['vlab-dev-android-task', 'vlab-dev-linux-task', 'vlab-dev-python-task']),
    instructions: '# Lab Instructions\n\n1. Start the container.\n2. SSH into the terminal.\n3. Execute the payload.',
    status,
    createdAt: faker.date.past({ years: 1 }),
    updatedAt: faker.date.recent({ days: 15 }),
  }
})

mockLabs.push(...additionalLabs)
