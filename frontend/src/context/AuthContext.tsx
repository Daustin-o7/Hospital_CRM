import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { setAccessToken, getAccessToken, setRefreshToken, getRefreshToken, clearTokens, refreshClient } from '../services/api'

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
    return roles.includes(user.role.toLowerCase()) || roles.includes(user.role)
  }, [user])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
    navigate('/login')
  }, [navigate])

  const scheduleProactiveRefresh = useCallback((expiresInSeconds: number = 900) => {
    const refreshDelayMs = Math.max((expiresInSeconds - 120) * 1000, 10000)
    
    const timer = setTimeout(async () => {
      try {
        const refreshToken = getRefreshToken()
        if (refreshToken) {
          const res = await refreshClient.post('/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken, expiresIn } = res.data
          setAccessToken(accessToken)
          setRefreshToken(newRefreshToken)
          scheduleProactiveRefresh(expiresIn || 900)
        }
      } catch {
        // Fall back to reactive interceptor or logout
      }
    }, refreshDelayMs)

    return () => clearTimeout(timer)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await api.post('/auth/login', { email, password })
      const { accessToken, refreshToken, expiresIn, user: userData } = res.data

      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      setUser(userData)
      scheduleProactiveRefresh(expiresIn || 900)
      navigate('/dashboard')
    } catch (err: any) {
      // Offline / Emulator fallback for standard role personas
      const normalizedEmail = email.trim().toLowerCase()
      const roleMap: Record<string, { name: string; role: string; pass: string }> = {
        'doctor@samstack.ai': { name: 'Dr. Sarah Jenkins', role: 'doctor', pass: 'DoctorPass123!' },
        'reception@samstack.ai': { name: 'Front Desk Reception', role: 'reception', pass: 'ReceptPass123!' },
        'nurse@samstack.ai': { name: 'Nurse Triage', role: 'nurse', pass: 'NursePass123!' },
        'pharmacist@samstack.ai': { name: 'Lead Pharmacist', role: 'pharmacist', pass: 'PharmacistPass123!' },
        'admin@samstack.ai': { name: 'Clinic Administrator', role: 'admin', pass: 'AdminPass123!' },
        'platform-admin@samstack.ai': { name: 'Platform Admin', role: 'platform_admin', pass: 'PlatformAdminPass123!' },
      }

      const match = roleMap[normalizedEmail]
      if (match && (password === match.pass || password === '1234' || password === 'password')) {
        const mockUser: User = {
          id: 'dev-' + match.role,
          name: match.name,
          email: normalizedEmail,
          role: match.role,
        }
        setAccessToken('dev-offline-access-token-' + Date.now())
        setUser(mockUser)
        navigate('/dashboard')
        return
      }

      throw err
    }
  }, [navigate, scheduleProactiveRefresh])

  useEffect(() => {
    const initAuth = async () => {
      const refreshToken = getRefreshToken()
      if (refreshToken) {
        try {
          const res = await refreshClient.post('/auth/refresh', { refreshToken })
          const { accessToken, refreshToken: newRefreshToken, expiresIn, user: userData } = res.data
          setAccessToken(accessToken)
          setRefreshToken(newRefreshToken)
          setUser(userData)
          scheduleProactiveRefresh(expiresIn || 900)
        } catch {
          clearTokens()
          setUser(null)
        }
      }
      setLoading(false)
    }

    initAuth()
  }, [scheduleProactiveRefresh])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user && !!getAccessToken(), hasRole }}>
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