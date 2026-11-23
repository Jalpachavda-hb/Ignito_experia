import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'
// Live: the owner API is served from the same origin under /owner-api (nginx), so a domain
// change needs no rebuild. VITE_API_URL may be absolute or relative ("/owner-api").
const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')
export const OWNER_API_BASE =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && !isLocalHost(window.location.hostname)
    ? `${window.location.origin}/owner-api`
    : 'http://localhost:4000/api')
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
