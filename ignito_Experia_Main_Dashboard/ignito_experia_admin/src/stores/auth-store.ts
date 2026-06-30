import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OwnerUser {
  ownerId: number
  email: string
  fullName: string
  role: string
}

interface AuthState {
  user: OwnerUser | null
  accessToken: string | null
  setAuth: (user: OwnerUser, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => set({ user, accessToken: token }),
      logout: () => set({ user: null, accessToken: null }),
    }),
    {
      name: 'owner-auth-storage',
    }
  )
)
