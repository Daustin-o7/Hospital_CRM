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

export interface ImpersonationSession {
  impersonationId: string
  targetUser: User
  expiresAt: number
  startedAt: string
  reason: string
  // Stored so a reload keeps operating as the impersonated user, not the admin.
  accessToken: string
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithEntra: () => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  hasRole: (roles: string[]) => boolean
  setUserFromEntra: (user: User) => void
  isEntraEnabled: boolean
  impersonation: ImpersonationSession | null
  startImpersonation: (session: {
    impersonationId: string
    accessToken: string
    expiresIn: number
    targetUser: User
    reason: string
  }) => void
  endImpersonation: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [impersonation, setImpersonation] = useState<ImpersonationSession | null>(() => {
    try {
      const raw = sessionStorage.getItem('samstack_impersonation')
      if (raw) {
        const parsed = JSON.parse(raw) as ImpersonationSession
        if (parsed.expiresAt > Date.now()) return parsed
      }
    } catch {
      // ignore
    }
    return null
  })
  const navigate = useNavigate()

  const hasRole = useCallback((roles: string[]) => {
    if (!user) return false
    return roles.includes(user.role.toLowerCase()) || roles.includes(user.role)
  }, [user])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {})
    } catch {
      // Non-blocking logout call
    }
    clearTokens()
    setUser(null)
    sessionStorage.removeItem('samstack_impersonation')
    sessionStorage.removeItem('samstack_admin_backup')
    setImpersonation(null)
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
        // Never refresh the admin's session while impersonating: it would replace the
        // read-only impersonation token with the admin's and silently escape the limits.
        if (sessionStorage.getItem('samstack_impersonation')) return
        const refreshToken = getRefreshToken()
        const res = await refreshClient.post('/auth/refresh', refreshToken ? { refreshToken } : {})
        const { accessToken, refreshToken: newRefreshToken, expiresIn } = res.data
        setAccessToken(accessToken)
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken)
        }
        scheduleProactiveRefresh(expiresIn || 900)
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
    navigate(String(userData?.role || '').toLowerCase() === 'platformadmin' ? '/dashboard/platform-admin' : '/dashboard')
  }, [navigate, scheduleProactiveRefresh])

  useEffect(() => {
    const initAuth = async () => {
      // 0. Resume an impersonation session across a reload. It has no refresh token of its own,
      // so falling through to the normal refresh path would silently install the admin's token
      // and drop the read-only + audit claims.
      const storedImpersonation = sessionStorage.getItem('samstack_impersonation')
      if (storedImpersonation) {
        try {
          const session = JSON.parse(storedImpersonation) as ImpersonationSession
          if (session.expiresAt > Date.now() && session.accessToken) {
            setAccessToken(session.accessToken)
            setUser(session.targetUser)
            setLoading(false)
            return
          }
        } catch {
          // Corrupt entry - fall through to a normal login.
        }
        sessionStorage.removeItem('samstack_impersonation')
        setImpersonation(null)
      }

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

      // 2. Standard refresh token flow (storage or HttpOnly cookie)
      const refreshToken = getRefreshToken()
      try {
        const res = await refreshClient.post('/auth/refresh', refreshToken ? { refreshToken } : {})
        const { accessToken, refreshToken: newRefreshToken, expiresIn, user: userData } = res.data
        setAccessToken(accessToken)
        if (newRefreshToken) {
          setRefreshToken(newRefreshToken)
        }
        setUser(userData)
        scheduleProactiveRefresh(expiresIn || 900)
      } catch {
        clearTokens()
        setUser(null)
      }
      setLoading(false)
    }

    initAuth()
  }, [scheduleProactiveRefresh])

  const startImpersonation = useCallback((session: {
    impersonationId: string
    accessToken: string
    expiresIn: number
    targetUser: User
    reason: string
  }) => {
    // 1. Back up original admin state to sessionStorage
    const currentToken = getAccessToken()
    const currentRefreshToken = getRefreshToken()
    const backup = {
      adminUser: user,
      accessToken: currentToken,
      refreshToken: currentRefreshToken
    }
    sessionStorage.setItem('samstack_admin_backup', JSON.stringify(backup))

    // 2. Set impersonation token and state
    const impState: ImpersonationSession = {
      impersonationId: session.impersonationId,
      targetUser: session.targetUser,
      expiresAt: Date.now() + session.expiresIn * 1000,
      startedAt: new Date().toISOString(),
      reason: session.reason,
      accessToken: session.accessToken
    }
    sessionStorage.setItem('samstack_impersonation', JSON.stringify(impState))
    setImpersonation(impState)

    // 3. Set API access token and active user
    setAccessToken(session.accessToken)
    setUser(session.targetUser)

    // 4. Navigate to dashboard as impersonated user
    navigate('/dashboard')
  }, [user, navigate])

  const endImpersonation = useCallback(async () => {
    const rawBackup = sessionStorage.getItem('samstack_admin_backup')
    const currentImp = impersonation

    // Attempt backend session end call
    if (currentImp?.impersonationId) {
      try {
        await api.post(`/platform-admin/impersonate/${currentImp.impersonationId}/end`, {})
      } catch {
        // Continue cleanup even if server call fails
      }
    }

    sessionStorage.removeItem('samstack_impersonation')
    sessionStorage.removeItem('samstack_admin_backup')
    setImpersonation(null)

    if (rawBackup) {
      try {
        const backup = JSON.parse(rawBackup)
        if (backup.accessToken) setAccessToken(backup.accessToken)
        if (backup.refreshToken) setRefreshToken(backup.refreshToken)
        if (backup.adminUser) setUser(backup.adminUser)
      } catch {
        // fallback
      }
    }

    navigate('/dashboard/platform-admin')
  }, [impersonation, navigate])

  // Impersonation auto-expiry
  useEffect(() => {
    if (!impersonation) return
    const remainingMs = impersonation.expiresAt - Date.now()
    if (remainingMs <= 0) {
      endImpersonation()
      return
    }
    const timer = setTimeout(() => {
      endImpersonation()
    }, remainingMs)
    return () => clearTimeout(timer)
  }, [impersonation, endImpersonation])

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
        impersonation,
        startImpersonation,
        endImpersonation,
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