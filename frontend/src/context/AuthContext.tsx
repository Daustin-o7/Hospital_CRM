import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  hasRole: (roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const hasRole = useCallback((roles: string[]) => {
    if (!user) return false
    return roles.includes(user.role)
  }, [user])

  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
    navigate('/login')
  }, [navigate])

  const scheduleProactiveRefresh = useCallback((expiresInSeconds: number = 900) => {
    // Schedule refresh 2 minutes (120s) before expiry
    const refreshDelayMs = Math.max((expiresInSeconds - 120) * 1000, 10000)
    
    const timer = setTimeout(async () => {
      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const res = await api.post('/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = res.data
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)
          scheduleProactiveRefresh(expiresIn || 900)
        }
      } catch {
        // If refresh fails, fall back to reactive interceptor or logout
      }
    }, refreshDelayMs)

    return () => clearTimeout(timer)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { accessToken, refreshToken, expiresIn, user: userData } = res.data

    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(userData))

    setUser(userData)
    scheduleProactiveRefresh(expiresIn || 900)
    navigate('/dashboard')
  }, [navigate, scheduleProactiveRefresh])

  useEffect(() => {
    const initAuth = () => {
      const storedUser = localStorage.getItem('user')
      const token = localStorage.getItem('accessToken')

      if (storedUser && token) {
        try {
          setUser(JSON.parse(storedUser))
          scheduleProactiveRefresh(900)
        } catch {
          localStorage.clear()
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [scheduleProactiveRefresh])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user, hasRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}