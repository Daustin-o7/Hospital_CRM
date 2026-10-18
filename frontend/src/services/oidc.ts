import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || ''
const subdomain = import.meta.env.VITE_ENTRA_TENANT_SUBDOMAIN || ''
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID || ''
const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI || `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE || ''

export const isEntraConfigured = Boolean(clientId && (subdomain || tenantId))

const authority = subdomain
  ? `https://${subdomain}.ciamlogin.com/${tenantId || subdomain}/v2.0`
  : `https://login.microsoftonline.com/${tenantId}/v2.0`

export const userManager: UserManager | null = isEntraConfigured
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
