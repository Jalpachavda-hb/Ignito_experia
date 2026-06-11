import { faker } from '@faker-js/faker'

// Set a fixed seed for consistent data generation
faker.seed(67890)

export const users = Array.from({ length: 500 }, () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const role = faker.helpers.arrayElement([
    'admin',
    'instructor',
    'student',
    'student',
    'student',
  ])
  return {
    id: faker.string.uuid(),
    firstName,
    lastName,
    username: faker.internet
      .username({ firstName, lastName })
      .toLocaleLowerCase(),
    email: faker.internet.email({ firstName }).toLocaleLowerCase(),
    phoneNumber: faker.phone.number({ style: 'international' }),
    status: faker.helpers.arrayElement([
      'active',
      'active',
      'active',
      'inactive',
      'invited',
      'suspended',
    ]),
    role,
    enrollmentNumber: role === 'student' ? faker.string.alphanumeric({ length: 8, casing: 'upper' }) : undefined,
    course: role === 'student' ? faker.helpers.arrayElement(['CS', 'CYB', 'DS', 'CC']) : undefined,
    semester: role === 'student' ? faker.helpers.arrayElement(['F24', 'S25', 'SU25']) : undefined,
    credits: faker.number.int({ min: 0, max: 10000 }),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }
})
