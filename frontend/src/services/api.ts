import axios from 'axios'

const isCapacitorOrWebView = typeof window !== 'undefined' && (
  !!(window as any).Capacitor ||
  (window.location.hostname === 'localhost' && window.location.port === '')
)

const resolveApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  if (isCapacitorOrWebView) {
    // In Android Emulator WebView, match protocol to prevent Mixed Content security blocking
    return window.location.protocol === 'https:'
      ? 'https://10.0.2.2:7001/api/v1'
      : 'http://10.0.2.2:5000/api/v1'
  }
  return '/api/v1'
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
  headers: {
    'Content-Type': 'application/json',
  },
})

export const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken) {
      config.headers.Authorization = `Bearer ${inMemoryAccessToken}`
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
        if (!refreshToken) throw new Error('No refresh token available')

        const res = await refreshClient.post('/auth/refresh', { refreshToken })
        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = res.data

        setAccessToken(newAccessToken)
        setRefreshToken(newRefreshToken)

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