import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Alert, friendlyError } from '../components/ui/Alert'
import { BrandLogo } from '../components/ui/BrandLogo'

export default function MfaSetup() {
  const { adoptSession, logout, user } = useAuth()
  const navigate = useNavigate()
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    // StrictMode mounts effects twice in dev; one pending secret must not be written twice.
    if (started.current) return
    started.current = true

    api.post('/auth/mfa/setup', {})
      .then(res => {
        setSecret(res.data.secret)
        setOtpauthUri(res.data.otpauthUri)
      })
      .catch(err => setError(friendlyError(err)))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your authenticator app.')
      return
    }
    setLoading(true)
    try {
      const res = await api.post('/auth/mfa/enable', { code: code.trim() })
      adoptSession(res.data)
      navigate(String(res.data?.user?.role || '').toLowerCase() === 'platformadmin'
        ? '/dashboard/platform-admin'
        : '/dashboard')
    } catch (err: any) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" theme="auto" organizationName="SAMSTACK AI" tagline="Clinical Operating System" />
        </div>
        <div className="card p-7">
          <h1 className="text-lg font-bold text-[var(--color-text)] font-heading">Set up two-factor authentication</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-5">
            The platform console requires an authenticator app. Add this account once, then enter the code it shows.
          </p>

          {error && (
            <div className="mb-5">
              <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>
            </div>
          )}

          <ol className="text-sm text-[var(--color-text-muted)] space-y-2 mb-5 list-decimal list-inside">
            <li>Open your authenticator app (Google Authenticator, 1Password, Authy…).</li>
            <li>Choose “Add account” and enter this key{user?.email ? ` for ${user.email}` : ''}:</li>
          </ol>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] p-4 mb-2">
            <code className="block text-center text-base font-mono tracking-[0.15em] break-all text-[var(--color-text)]">
              {secret || 'Generating…'}
            </code>
          </div>
          {otpauthUri && (
            <p className="text-[11px] text-[var(--color-text-muted)] mb-5 break-all">
              Or paste this link: <span className="font-mono">{otpauthUri}</span>
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="form-label">6-digit code</label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                className="form-input text-center tracking-[0.4em] font-mono"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading || !secret}>
              {loading ? 'Verifying…' : 'Enable two-factor authentication'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => void logout()}
            className="mt-4 w-full text-center text-xs font-semibold text-[var(--color-text-muted)] hover:underline"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  )
}
