import { Shield, BookOpen, GraduationCap } from 'lucide-react'
import { type UserStatus } from './schema'

export const callTypes = new Map<UserStatus, string>([
  ['active', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['inactive', 'bg-neutral-300/40 border-neutral-300'],
  ['invited', 'bg-sky-200/40 text-sky-900 dark:text-sky-100 border-sky-300'],
  [
    'suspended',
    'bg-destructive/10 dark:bg-destructive/50 text-destructive dark:text-primary border-destructive/10',
  ],
])

export const roles = [
  {
    label: 'Admin',
    value: 'admin',
    icon: Shield,
  },
  {
    label: 'Instructor',
    value: 'instructor',
    icon: BookOpen,
  },
  {
    label: 'Student',
    value: 'student',
    icon: GraduationCap,
  },
] as const

export const courses = [
  { label: 'Computer Science', value: 'CS' },
  { label: 'Cyber Security', value: 'CYB' },
  { label: 'Data Science', value: 'DS' },
  { label: 'Cloud Computing', value: 'CC' },
] as const

export const semesters = [
  { label: 'Fall 2024', value: 'F24' },
  { label: 'Spring 2025', value: 'S25' },
  { label: 'Summer 2025', value: 'SU25' },
] as const
