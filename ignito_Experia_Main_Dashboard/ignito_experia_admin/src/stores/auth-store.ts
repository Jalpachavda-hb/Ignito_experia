import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OwnerUser {
  ownerId: number
  email: string
  fullName: string
  phoneNumber?: string
  designation?: string
  organization?: string
  avatarUrl?: string
  role: string
}

interface AuthState {
  user: OwnerUser | null
  accessToken: string | null
  setAuth: (user: OwnerUser, token: string) => void
  updateUser: (user: Partial<OwnerUser>) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, token) => set({ user, accessToken: token }),
      updateUser: (updatedFields) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        })),
      logout: () => set({ user: null, accessToken: null }),
    }),

    {
      name: 'owner-auth-storage',
    }
  )
)
