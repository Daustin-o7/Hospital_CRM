import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { userManager, isEntraConfigured } from '../services/oidc'
import { setAccessToken } from '../services/api'
import { useAuth } from '../context/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const { setUserFromEntra } = useAuth()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      if (!isEntraConfigured || !userManager) {
        navigate('/login')
        return
      }

      try {
        const oidcUser = await userManager.signinRedirectCallback()
        if (oidcUser && oidcUser.access_token) {
          setAccessToken(oidcUser.access_token)
          const profile = oidcUser.profile
          const roles = (profile.roles as string[]) || (profile.extension_Role as string) || (profile.role as string) || 'doctor'
          const role = Array.isArray(roles) ? roles[0] : roles

          setUserFromEntra({
            id: oidcUser.profile.sub,
            name: oidcUser.profile.name || oidcUser.profile.preferred_username || 'Doctor',
            email: oidcUser.profile.email || (oidcUser.profile as any).upn || '',
            role: String(role).toLowerCase()
          })

          navigate('/dashboard')
        } else {
          throw new Error('No access token received from authentication provider')
        }
      } catch (err: any) {
        console.error('OIDC callback failed:', err)
        setError(err.message || 'Authentication callback failed')
      }
    }

    handleCallback()
  }, [navigate, setUserFromEntra])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="card p-6 max-w-md w-full text-center">
          <div className="text-rose-500 font-bold mb-2">Authentication Error</div>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary w-full"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
      <div className="spinner spinner-lg mb-4" />
      <div className="text-sm font-medium">Completing secure sign-in…</div>
    </div>
  )
}
