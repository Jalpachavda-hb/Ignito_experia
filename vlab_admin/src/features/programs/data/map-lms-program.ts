import { type Program } from './schema'

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = Number(value)
    if (Number.isFinite(n) && n >= 0) return n
  }
  return undefined
}

function inferDegree(name: string, programLevelId?: unknown): string {
  const lower = String(name || '').toLowerCase()
  if (lower.includes('doctor') || lower.includes('ph.d') || lower.includes('phd')) return 'Doctorate'
  if (lower.includes('master') || lower.includes('mca') || lower.includes('m.tech') || lower.includes('mba')) return 'Masters'
  if (lower.includes('bachelor') || lower.includes('bca') || lower.includes('b.tech') || lower.includes('btech')) return 'Bachelors'
  if (lower.includes('diploma')) return 'Diploma'
  const level = Number(programLevelId)
  if (level === 2) return 'Masters'
  if (level === 1) return 'Bachelors'
  if (level === 3) return 'Doctorate'
  return ''
}

export function extractProgramList(res: any): any[] {
  if (!res) return []
  if (Array.isArray(res.programList)) return res.programList
  if (Array.isArray(res.programmeList)) return res.programmeList
  if (Array.isArray(res.rawData?.programList)) return res.rawData.programList
  if (Array.isArray(res.rawData?.programmeList)) return res.rawData.programmeList
  if (Array.isArray(res)) return res
  return []
}

export function mapLmsProgram(p: any): Program {
  const name = p.programName || p.programmeName || p.programmeNameAndCode || 'Academic Program'
  const code = p.programCode || p.programmeCode || ''
  const durationText = String(p.programmeDuration || p.durationText || '').trim() || undefined
  const durationYears = firstNumber(p.durationYears)
  const totalSemesters = firstNumber(p.totalSemesters)
  const totalStudents = firstNumber(p.totalStudents, p.programSeats, p.programmeSeats)
  const totalLabs = firstNumber(p.totalLabs)
  const totalCourses = firstNumber(p.totalCourses)

  return {
    id: String(p.programId ?? p.programmeId ?? ''),
    name,
    code,
    degree: inferDegree(name, p.programLevelId),
    durationYears,
    durationText: durationText || (durationYears ? `${durationYears} Years` : undefined),
    totalCourses,
    totalSemesters,
    totalStudents,
    totalLabs,
    status: p.isActive === false || String(p.status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active',
    rawLmsData: p,
  }
}

export function findLmsProgram(list: any[], programId: string): any | null {
  const wanted = String(programId || '').trim().toLowerCase()
  if (!wanted) return null
  return (
    list.find((p) =>
      [p.programId, p.programmeId, p.programCode, p.programmeCode]
        .filter((v) => v != null && String(v).trim() !== '')
        .some((v) => String(v).trim().toLowerCase() === wanted)
    ) || null
  )
}
