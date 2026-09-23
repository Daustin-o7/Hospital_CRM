import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { setAccessToken, getAccessToken, setRefreshToken, getRefreshToken, clearTokens, refreshClient } from '../services/api'
import { userManager, isEntraConfigured } from '../services/oidc'

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
  loginWithEntra: () => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  hasRole: (roles: string[]) => boolean
  setUserFromEntra: (user: User) => void
  isEntraEnabled: boolean
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

  const logout = useCallback(async () => {
    clearTokens()
    setUser(null)
    if (isEntraConfigured && userManager) {
      try {
        await userManager.signoutRedirect()
        return
      } catch (err) {
        console.warn('Entra signout redirect failed:', err)
      }
    }
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

  const loginWithEntra = useCallback(async () => {
    if (userManager) {
      await userManager.signinRedirect()
    } else {
      throw new Error('Azure Entra External ID is not configured.')
    }
  }, [])

  const setUserFromEntra = useCallback((userData: User) => {
    setUser(userData)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password })
    const { accessToken, refreshToken, expiresIn, user: userData } = res.data

    setAccessToken(accessToken)
    setRefreshToken(refreshToken)
    setUser(userData)
    scheduleProactiveRefresh(expiresIn || 900)
    navigate('/dashboard')
  }, [navigate, scheduleProactiveRefresh])

  useEffect(() => {
    const initAuth = async () => {
      // 1. Check if OIDC user is cached in storage
      if (isEntraConfigured && userManager) {
        try {
          const oidcUser = await userManager.getUser()
          if (oidcUser && !oidcUser.expired && oidcUser.access_token) {
            setAccessToken(oidcUser.access_token)
            const profile = oidcUser.profile
            const roles = (profile.roles as string[]) || (profile.extension_Role as string) || (profile.role as string) || 'doctor'
            const role = Array.isArray(roles) ? roles[0] : roles

            setUser({
              id: oidcUser.profile.sub,
              name: oidcUser.profile.name || oidcUser.profile.preferred_username || 'Doctor',
              email: oidcUser.profile.email || (oidcUser.profile as any).upn || '',
              role: String(role).toLowerCase()
            })
            setLoading(false)
            return
          }
        } catch (err) {
          console.warn('OIDC restore failed:', err)
        }
      }

      // 2. Standard refresh token flow
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithEntra,
        logout,
        isAuthenticated: !!user && !!getAccessToken(),
        hasRole,
        setUserFromEntra,
        isEntraEnabled: isEntraConfigured,
      }}
    >
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