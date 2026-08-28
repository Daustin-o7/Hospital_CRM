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

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { accessToken, refreshToken, user: userData } = res.data
    
    localStorage.setItem('accessToken', accessToken)
    localStorage.setItem('refreshToken', refreshToken)
    localStorage.setItem('user', JSON.stringify(userData))
    
    setUser(userData)
    navigate('/dashboard')
  }, [navigate])

  const logout = useCallback(() => {
    localStorage.clear()
    setUser(null)
    navigate('/login')
  }, [navigate])

  useEffect(() => {
    const initAuth = () => {
      const storedUser = localStorage.getItem('user')
      const token = localStorage.getItem('accessToken')
      
      if (storedUser && token) {
        try {
          setUser(JSON.parse(storedUser))
        } catch {
          localStorage.clear()
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

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