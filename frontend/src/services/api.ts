import axios from 'axios'

const isCapacitorOrWebView = typeof window !== 'undefined' && (
  !!(window as any).Capacitor ||
  (window.location.hostname === 'localhost' && window.location.port === '')
)

const resolveApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('hospital_crm_api_base_url')
    if (custom && custom.trim()) {
      return custom.trim()
    }
  }
  if (isCapacitorOrWebView) {
    return 'http://10.0.2.2:5000/api/v1'
  }
  return '/api/v1'
}

export function setCustomApiBaseUrl(url: string) {
  if (typeof window === 'undefined') return
  if (url && url.trim()) {
    localStorage.setItem('hospital_crm_api_base_url', url.trim())
  } else {
    localStorage.removeItem('hospital_crm_api_base_url')
  }
}

export function getCustomApiBaseUrl(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('hospital_crm_api_base_url') || ''
}

const API_BASE_URL = resolveApiBaseUrl()

let inMemoryAccessToken: string | null = null

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken
}

export function setRefreshToken(token: string | null) {
  if (token) {
    sessionStorage.setItem('refreshToken', token)
  } else {
    sessionStorage.removeItem('refreshToken')
  }
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem('refreshToken')
}

export function clearTokens() {
  inMemoryAccessToken = null
  sessionStorage.removeItem('refreshToken')
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`
    }
    try {
      const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (clientTz) {
        config.headers['X-Timezone'] = clientTz
      }
    } catch {
      // Fallback in environments without Intl
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    const isAuthRoute = originalRequest?.url?.includes('/auth/')
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute) {
      originalRequest._retry = true
      try {
        const refreshToken = getRefreshToken()
        // Send body token if present; HttpOnly cookie will automatically be sent via withCredentials
        const res = await refreshClient.post('/auth/refresh', refreshToken ? { refreshToken } : {})
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data

        setAccessToken(newAccessToken)
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken)
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        clearTokens()
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

export default api