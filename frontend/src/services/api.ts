import axios from 'axios'

const API_BASE_URL = '/api/v1'

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