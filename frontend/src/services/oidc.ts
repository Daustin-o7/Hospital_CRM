import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const isCapacitorOrWebView = typeof window !== 'undefined' && (
  !!(window as any).Capacitor ||
  (window.location.hostname === 'localhost' && window.location.port === '')
)

const resolveDefaultAuthority = () => {
  if (typeof window === 'undefined') return ''
  if (isCapacitorOrWebView) {
    return 'http://10.0.2.2:5000'
  }
  return window.location.origin
}

// In-house OpenIddict Authority (.NET 10) with backward-compatible fallbacks
const authority =
  import.meta.env.VITE_AUTH_AUTHORITY ||
  import.meta.env.VITE_OIDC_AUTHORITY ||
  (import.meta.env.VITE_ENTRA_TENANT_SUBDOMAIN
    ? `https://${import.meta.env.VITE_ENTRA_TENANT_SUBDOMAIN}.ciamlogin.com/${import.meta.env.VITE_ENTRA_TENANT_ID || import.meta.env.VITE_ENTRA_TENANT_SUBDOMAIN}/v2.0`
    : import.meta.env.VITE_ENTRA_TENANT_ID
    ? `https://login.microsoftonline.com/${import.meta.env.VITE_ENTRA_TENANT_ID}/v2.0`
    : resolveDefaultAuthority())

const clientId =
  import.meta.env.VITE_AUTH_CLIENT_ID ||
  import.meta.env.VITE_CLIENT_ID ||
  import.meta.env.VITE_ENTRA_CLIENT_ID ||
  'hospital-crm-pwa'

const redirectUri =
  import.meta.env.VITE_AUTH_REDIRECT_URI ||
  import.meta.env.VITE_ENTRA_REDIRECT_URI ||
  `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`

const apiScope =
  import.meta.env.VITE_AUTH_SCOPE ||
  import.meta.env.VITE_ENTRA_API_SCOPE ||
  'api roles'

export const isOidcConfigured = Boolean(
  authority &&
  clientId &&
  (import.meta.env.VITE_AUTH_AUTHORITY ||
   import.meta.env.VITE_OIDC_AUTHORITY ||
   import.meta.env.VITE_AUTH_CLIENT_ID ||
   import.meta.env.VITE_ENTRA_CLIENT_ID)
)

// Backward-compatible alias
export const isEntraConfigured = isOidcConfigured

export const userManager: UserManager | null = isOidcConfigured
  ? new UserManager({
      authority,
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: `openid profile email ${apiScope}`.trim(),
      userStore: typeof window !== 'undefined' ? new WebStorageStateStore({ store: window.sessionStorage }) : undefined,
      automaticSilentRenew: true,
      loadUserInfo: true,
    })
  : null
