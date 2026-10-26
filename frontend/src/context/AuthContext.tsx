import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import api, { setAccessToken, getAccessToken, clearTokens, refreshClient } from '../services/api'
import { clearOutbox } from '../services/offlineOutbox'
import { userManager, isEntraConfigured } from '../services/oidc'

interface User {
  id: string
  name: string
  email: string
  role: string
}

export interface TenantMembership {
  tenantId: string
  tenantName?: string
  clinicId?: string | null
  clinicName: string
  role: string
  isDefault: boolean
  status?: string
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

export interface LoginResult {
  mfaRequired: boolean
  challengeToken?: string
  // Which second factor the account enrolled, so the code step can label itself.
  method?: 'totp' | 'email'
  requiresTenantSelection?: boolean
  selectionToken?: string
  memberships?: TenantMembership[]
}

interface SessionPayload {
  accessToken: string
  expiresIn?: number
  tenantId?: string | null
  clinicId?: string | null
  mfaEnrolmentRequired?: boolean
  mfaRequiredForRole?: boolean
  user: User
  memberships?: TenantMembership[]
}

function claimsFromToken(token: string | null): Record<string, unknown> {
  if (!token) return {}
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

// A1 flags live in the token, so a reload restores the same gate without another call.
// Second-factor enrolment is mandatory for admin/doctor/billing roles.
function accountFlagsFrom(token: string | null) {
  const claims = claimsFromToken(token)
  return {
    mustChangePassword: claims.must_change_password === 'true',
    mfaEnrolmentRequired: claims.mfa_enrolment_required === 'true',
  }
}

export interface AuthContextType {
  user: User | null
  loading: boolean
  memberships: TenantMembership[]
  currentTenantId: string | null
  currentClinicId: string | null
  mfaEnrolmentRequired: boolean
  mfaRequiredForRole: boolean
  login: (email: string, password: string, tenantId?: string) => Promise<LoginResult>
  completeMfa: (challengeToken: string, code: string) => Promise<LoginResult | void>
  selectTenant: (tenantId: string, selectionToken?: string, clinicId?: string | null) => Promise<void>
  switchTenant: (tenantId: string, clinicId?: string | null) => Promise<void>
  revokeAllSessions: () => Promise<void>
  refreshMemberships: () => Promise<void>
  adoptSession: (session: SessionPayload) => void
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  mustChangePassword: boolean
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
  const [memberships, setMemberships] = useState<TenantMembership[]>([])
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [currentClinicId, setCurrentClinicId] = useState<string | null>(null)
  const [accountFlags, setAccountFlags] = useState({ mustChangePassword: false, mfaEnrolmentRequired: false })
  const [mfaRequiredForRole, setMfaRequiredForRole] = useState(false)
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
    setMemberships([])
    setCurrentTenantId(null)
    setCurrentClinicId(null)
    setAccountFlags({ mustChangePassword: false, mfaEnrolmentRequired: false })
    setMfaRequiredForRole(false)
    // Unsaved consultation drafts hold patient data; never leave them on a shared device.
    Object.keys(localStorage)
      .filter(k => k.startsWith('hospital_crm_draft_'))
      .forEach(k => localStorage.removeItem(k))
    // Queued invoices carry patient names too.
    clearOutbox()
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
        const res = await refreshClient.post('/auth/refresh', {})
        if (res.status === 204 || !res.data?.accessToken) return
        const { accessToken, expiresIn, tenantId, clinicId, memberships: nextMemberships, mfaRequiredForRole: roleNeedsMfa } = res.data
        setAccessToken(accessToken)
        if (tenantId) setCurrentTenantId(tenantId)
        if (clinicId) setCurrentClinicId(clinicId)
        if (Array.isArray(nextMemberships)) setMemberships(nextMemberships)
        if (typeof roleNeedsMfa === 'boolean') setMfaRequiredForRole(roleNeedsMfa)
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
      throw new Error('Single Sign-On (OIDC) identity provider is not configured.')
    }
  }, [])

  const setUserFromEntra = useCallback((userData: User) => {
    setUser(userData)
  }, [])

  const adoptSession = useCallback((session: SessionPayload) => {
    setAccessToken(session.accessToken)
    if (session.user) setUser(session.user)
    const claims = claimsFromToken(session.accessToken)
    const tokenTenantId = (claims.tenant_id as string) || session.tenantId || null
    const tokenClinicId = (claims.clinicId as string) || session.clinicId || null
    setCurrentTenantId(tokenTenantId)
    setCurrentClinicId(tokenClinicId)
    if (session.memberships && Array.isArray(session.memberships)) {
      setMemberships(session.memberships)
    }
    setAccountFlags(accountFlagsFrom(session.accessToken))
    setMfaRequiredForRole(session.mfaRequiredForRole === true)
    scheduleProactiveRefresh(session.expiresIn || 900)
  }, [scheduleProactiveRefresh])

  // A session holding a temporary password or a mandatory second factor may not use the app shell.
  const routeAfterSession = useCallback((session: SessionPayload) => {
    const flags = accountFlagsFrom(session.accessToken)
    if (flags.mustChangePassword) {
      navigate('/change-password')
      return
    }
    if (flags.mfaEnrolmentRequired) {
      navigate('/setup-mfa')
      return
    }
    navigate(String(session.user?.role || '').toLowerCase() === 'platformadmin' ? '/dashboard/platform-admin' : '/dashboard')
  }, [navigate])

  const completeMfa = useCallback(async (challengeToken: string, code: string): Promise<LoginResult | void> => {
    const res = await api.post('/auth/mfa/verify', { challengeToken, code })
    if (res.data?.requiresTenantSelection) {
      return {
        mfaRequired: false,
        requiresTenantSelection: true,
        selectionToken: res.data.selectionToken,
        memberships: res.data.memberships
      }
    }
    adoptSession(res.data)
    routeAfterSession(res.data)
  }, [adoptSession, routeAfterSession])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const res = await api.post('/auth/change-password', { currentPassword, newPassword })
    adoptSession(res.data)
    routeAfterSession(res.data)
  }, [adoptSession, routeAfterSession])

  const selectTenant = useCallback(async (tenantId: string, selectionToken?: string, clinicId?: string | null) => {
    const res = await api.post('/auth/select-tenant', { tenantId, clinicId: clinicId ?? null, selectionToken })
    adoptSession(res.data)
    routeAfterSession(res.data)
  }, [adoptSession, routeAfterSession])

  const switchTenant = useCallback(async (tenantId: string, clinicId?: string | null) => {
    // A clinic switch mints a new token scoped to that one tenant; never reuse the old one.
    const res = await api.post('/auth/select-tenant', { tenantId, clinicId: clinicId ?? null })
    adoptSession(res.data)
    if (String(user?.role || '').toLowerCase() === 'platformadmin') {
      navigate('/dashboard/platform-admin')
    } else {
      navigate('/dashboard')
    }
  }, [adoptSession, navigate, user?.role])

  const refreshMemberships = useCallback(async () => {
    try {
      const res = await api.get('/auth/memberships')
      if (Array.isArray(res.data)) {
        setMemberships(res.data)
      }
    } catch {
      // non-blocking
    }
  }, [])

  const revokeAllSessions = useCallback(async () => {
    try {
      await api.post('/auth/revoke-all', {})
    } catch {
      // Non-blocking
    }
    clearTokens()
    setUser(null)
    setMemberships([])
    setCurrentTenantId(null)
    setCurrentClinicId(null)
    setAccountFlags({ mustChangePassword: false, mfaEnrolmentRequired: false })
    setMfaRequiredForRole(false)
    // Same device hygiene as logout: no patient data left behind on a shared front desk.
    Object.keys(localStorage)
      .filter(k => k.startsWith('hospital_crm_draft_'))
      .forEach(k => localStorage.removeItem(k))
    clearOutbox()
    navigate('/login')
  }, [navigate])

  const login = useCallback(async (email: string, password: string, tenantId?: string): Promise<LoginResult> => {
    const res = await api.post('/auth/login', { email, password, tenantId })

    // With a second factor enrolled the password only buys a 5-minute challenge.
    if (res.data?.mfaRequired) {
      return { mfaRequired: true, challengeToken: res.data.challengeToken, method: res.data.method }
    }

    if (res.data?.requiresTenantSelection) {
      return {
        mfaRequired: false,
        requiresTenantSelection: true,
        selectionToken: res.data.selectionToken,
        memberships: res.data.memberships
      }
    }

    adoptSession(res.data)
    routeAfterSession(res.data)
    return { mfaRequired: false }
  }, [adoptSession, routeAfterSession])

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

      // 2. Refresh from the HttpOnly cookie (no token is ever kept in JS storage)
      try {
        const res = await refreshClient.post('/auth/refresh', {})
        if (res.status === 204 || !res.data?.accessToken) {
          // No session on this device (204) - stay signed out without an error.
          setLoading(false)
          return
        }
        const { accessToken, expiresIn, user: userData, memberships: savedMemberships, tenantId, clinicId, mfaRequiredForRole: roleNeedsMfa } = res.data
        setAccessToken(accessToken)
        setUser(userData)
        if (tenantId) setCurrentTenantId(tenantId)
        if (clinicId) setCurrentClinicId(clinicId)
        if (Array.isArray(savedMemberships)) setMemberships(savedMemberships)
        if (typeof roleNeedsMfa === 'boolean') setMfaRequiredForRole(roleNeedsMfa)
        setAccountFlags(accountFlagsFrom(accessToken))
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
    const backup = {
      adminUser: user,
      accessToken: currentToken
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
    setAccountFlags(accountFlagsFrom(session.accessToken))

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
        memberships,
        currentTenantId,
        currentClinicId,
        mfaEnrolmentRequired: accountFlags.mfaEnrolmentRequired,
        mfaRequiredForRole,
        login,
        completeMfa,
        selectTenant,
        switchTenant,
        revokeAllSessions,
        refreshMemberships,
        adoptSession,
        changePassword,
        mustChangePassword: accountFlags.mustChangePassword,
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