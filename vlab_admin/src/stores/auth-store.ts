import { create } from 'zustand'
import { getCookie, setCookie, removeCookie } from '@/lib/cookies'

const ACCESS_TOKEN = 'thisisjustarandomstring'
const REFRESH_TOKEN = 'refresh_token'

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
    reset: () => void
  }
}


export const useAuthStore = create<AuthState>()((set) => {
  const cookieState = getCookie(ACCESS_TOKEN)
  const initToken = cookieState ? JSON.parse(cookieState) : ''
  const refreshCookieState = getCookie(REFRESH_TOKEN)
  const initRefreshToken = refreshCookieState ? JSON.parse(refreshCookieState) : ''

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
            const u = { credits: 1000, ...user };
            if (typeof window !== 'undefined') localStorage.setItem('auth-user', JSON.stringify(u));
            return { ...state, auth: { ...state.auth, user: u } };
          } else {
            if (typeof window !== 'undefined') localStorage.removeItem('auth-user');
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
          setCookie(ACCESS_TOKEN, JSON.stringify(accessToken))
          return { ...state, auth: { ...state.auth, accessToken } }
        }),
      resetAccessToken: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          return { ...state, auth: { ...state.auth, accessToken: '' } }
        }),
      refreshToken: initRefreshToken,
      setRefreshToken: (refreshToken) =>
        set((state) => {
          setCookie(REFRESH_TOKEN, JSON.stringify(refreshToken))
          return { ...state, auth: { ...state.auth, refreshToken } }
        }),
      resetRefreshToken: () =>
        set((state) => {
          removeCookie(REFRESH_TOKEN)
          return { ...state, auth: { ...state.auth, refreshToken: '' } }
        }),
      reset: () =>
        set((state) => {
          removeCookie(ACCESS_TOKEN)
          removeCookie(REFRESH_TOKEN)
          if (typeof window !== 'undefined') localStorage.removeItem('auth-user');
          return {
            ...state,
            auth: { ...state.auth, user: null, accessToken: '', refreshToken: '' },
          }
        }),
    },
  }
})
