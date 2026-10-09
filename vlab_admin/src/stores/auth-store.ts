import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'thisisjustarandomstring'
const REFRESH_TOKEN = 'refresh_token'
const LMS_TOKEN = 'lms_student_token'
const ACCESS_TOKEN_STORAGE = 'auth-access-token'
const REFRESH_TOKEN_STORAGE = 'auth-refresh-token'
const LMS_TOKEN_STORAGE = 'auth-lms-token'

function readStored(key: string) {
  if (typeof window === 'undefined') return ''
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStored(key: string, value: string) {
  if (typeof window === 'undefined') return
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    // Ignore storage failures; the in-memory session still works for this tab.
  }
}

function readToken(cookieName: string, storageKey: string) {
  const raw = getCookie(cookieName)
  if (raw) {
    try {
      const decoded = decodeURIComponent(raw)
      if (decoded.startsWith('"')) return JSON.parse(decoded)
      return decoded
    } catch {
      return String(raw).replace(/^"|"$/g, '')
    }
  }
  return readStored(storageKey)
}

function writeToken(cookieName: string, storageKey: string, token: string) {
  if (!token) {
    removeCookie(cookieName)
    writeStored(storageKey, '')
    return
  }
  setCookie(cookieName, encodeURIComponent(token))
  writeStored(storageKey, token)
}

export interface AuthUser {
  userId: number | string
  fullName: string
  name?: string
  email: string
  role: string
  roleId?: number
  tenantId?: string
  tenantSlug?: string
  tenantName?: string
  status: string
  programId?: number | null
  semesterId?: number | null
  exp: number
  credits?: number
  hasPassword?: boolean
  profileImage?: string
  avatar?: string
  createdFrom?: string
  authType?: string
  studentDegreeAdmissionId?: number | string
  studentId?: number | string
  programName?: string
  programmesList?: any[]
  mobile?: string
  phoneNumber?: string
  organization?: string
  tokens?: number
  currentSemester?: number | string
  collegeName?: string
  permissions?: Record<string, {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  }>
  [key: string]: any
}

export interface AuthState {
  auth: {
    user: AuthUser | null
    setUser: (user: AuthUser | null) => void
    updateUser: (updates: Partial<AuthUser>) => void
    accessToken: string
    setAccessToken: (accessToken: string) => void
    resetAccessToken: () => void
    refreshToken?: string
    setRefreshToken?: (refreshToken: string) => void
    resetRefreshToken?: () => void
    lmsToken?: string
    setLmsToken?: (lmsToken: string) => void
    reset: () => void
  }
}


export const useAuthStore = create<AuthState>()((set) => {
  const initToken = readToken(ACCESS_TOKEN, ACCESS_TOKEN_STORAGE)
  const initRefreshToken = readToken(REFRESH_TOKEN, REFRESH_TOKEN_STORAGE)
  const initLmsToken = readToken(LMS_TOKEN, LMS_TOKEN_STORAGE)

  let initUser = null
  if (typeof window !== 'undefined') {
    try {
      const storedUser = localStorage.getItem('auth-user')
      if (storedUser) {
        initUser = JSON.parse(storedUser)
      }
    } catch (e) {}
  }

  return {
    auth: {
      user: initUser,
      setUser: (user) =>
        set((state) => {
          if (user) {
            const prevUser = state.auth.user;
            const userChanged = prevUser && (
              String(prevUser.userId) !== String(user.userId) ||
              String(prevUser.email || '').toLowerCase() !== String(user.email || '').toLowerCase()
            );

            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem('vlab_student_transactions');
                if (userChanged) {
                  const oldKey = prevUser.userId || prevUser.id || prevUser.email;
                  if (oldKey) {
                    localStorage.removeItem(`vlab_student_transactions_${String(oldKey).trim().toLowerCase()}`);
                    localStorage.removeItem(`ignito_student_lab_history_${String(oldKey).trim().toLowerCase()}`);
                    localStorage.removeItem(`ignito_student_lab_credit_usage_${String(oldKey).trim().toLowerCase()}`);
                  }
                  if (prevUser.email) {
                    localStorage.removeItem(`ignito_student_lab_history_${String(prevUser.email).trim().toLowerCase()}`);
                  }
                }
                localStorage.setItem('auth-user', JSON.stringify(user));
              } catch (_) {}
            }

            return { ...state, auth: { ...state.auth, user } };
          } else {
            if (typeof window !== 'undefined') {
              try {
                localStorage.removeItem('auth-user');
                localStorage.removeItem('vlab_student_transactions');
              } catch (_) {}
            }
            return { ...state, auth: { ...state.auth, user: null } };
          }
        }),
      updateUser: (updates) =>
        set((state) => {
          const user = state.auth.user ? { ...state.auth.user, ...updates } : null;
          if (user && typeof window !== 'undefined') {
            localStorage.setItem('auth-user', JSON.stringify(user));
          }
          return {
            ...state,
            auth: {
              ...state.auth,
              user,
            },
          }
        }),
      accessToken: initToken,
      setAccessToken: (accessToken) =>
        set((state) => {
          writeToken(ACCESS_TOKEN, ACCESS_TOKEN_STORAGE, accessToken)
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          writeToken(ACCESS_TOKEN, ACCESS_TOKEN_STORAGE, '')
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      refreshToken: initRefreshToken,
      setRefreshToken: (refreshToken) =>
        set((state) => {
          writeToken(REFRESH_TOKEN, REFRESH_TOKEN_STORAGE, refreshToken)
          return { ...state, auth: { ...state.auth, refreshToken } }
        }),
      resetRefreshToken: () =>
        set((state) => {
          writeToken(REFRESH_TOKEN, REFRESH_TOKEN_STORAGE, '')
          return { ...state, auth: { ...state.auth, refreshToken: '' } }
        }),
      lmsToken: initLmsToken,
      setLmsToken: (lmsToken) =>
        set((state) => {
          writeToken(LMS_TOKEN, LMS_TOKEN_STORAGE, lmsToken)
          return { ...state, auth: { ...state.auth, lmsToken } }
        }),
      reset: () =>
        set((state) => {
          writeToken(ACCESS_TOKEN, ACCESS_TOKEN_STORAGE, '')
          writeToken(REFRESH_TOKEN, REFRESH_TOKEN_STORAGE, '')
          writeToken(LMS_TOKEN, LMS_TOKEN_STORAGE, '')
          if (typeof window !== 'undefined') {
            try {
              localStorage.removeItem('auth-user');
              localStorage.removeItem('vlab_student_transactions');
              localStorage.removeItem('ignito_student_lab_credit_usage');
              const u = state.auth.user;
              const uKey = u?.userId || u?.id || u?.email;
              if (uKey) {
                localStorage.removeItem(`ignito_student_lab_history_${String(uKey).trim().toLowerCase()}`);
              }
              if (u?.email) {
                localStorage.removeItem(`ignito_student_lab_history_${String(u.email).trim().toLowerCase()}`);
              }
            } catch (_) {}
          }
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '', refreshToken: '', lmsToken: '' },
          }
        }),
    },
  }
})
