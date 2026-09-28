type StudentLike = {
  createdFrom?: string
  authType?: string
  studentDegreeAdmissionId?: string | number | null
  externalStudentId?: string | number | null
  tenantSlug?: string | null
  role?: string
} | null | undefined

/** University students arrive through LMS SSO and may later sign in with a password on the same portal. */
export function isUniversityStudent(user: StudentLike) {
  if (!user) return false
  const created = String(user.createdFrom || '').toUpperCase()
  const auth = String(user.authType || '').toUpperCase()
  if (created === 'LMS' || auth === 'LMS' || auth === 'LMS_AND_DIRECT') return true
  if (user.studentDegreeAdmissionId || user.externalStudentId) return true
  if (user.tenantSlug) return true
  return false
}

/** Direct students register on the main Experia site and have no university academic record. */
export function isDirectStudent(user: StudentLike) {
  if (!user) return false
  if (isUniversityStudent(user)) return false
  const role = String(user.role || '').toLowerCase()
  if (role && role !== 'student') return false
  return true
}
