import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'

const OWNER_API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

export const api = axios.create({
  baseURL: OWNER_API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/sign-in'
    }
    return Promise.reject(error)
  }
)

export async function apiRequest<T = unknown>(
  url: string,
  options?: {
    method?: string
    body?: string
    headers?: Record<string, string>
  }
): Promise<T> {
  const method = (options?.method || 'GET').toLowerCase()
  const data = options?.body ? JSON.parse(options.body) : undefined

  const response = await api.request<T>({
    url,
    method,
    data,
    headers: options?.headers,
  })
  return response.data
}
