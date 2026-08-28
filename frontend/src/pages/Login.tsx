import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Alert, friendlyError } from '../components/ui/Alert'

const IS_DEV = import.meta.env.DEV

export default function Login() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const { login }                 = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err: any) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const preset = (e: string, p: string) => { setEmail(e); setPassword(p); setError('') }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', background: '#f4f6f9' }}>
      {/* ── Left panel — branding ────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          flex: '0 0 44%',
          background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 60%, #0d9488 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '48px 40px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="hide-tablet"
      >
        {/* Subtle background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              radial-gradient(circle at 20% 80%, rgba(13,148,136,0.25) 0%, transparent 50%),
              radial-gradient(circle at 80% 20%, rgba(8,145,178,0.15) 0%, transparent 50%)
            `,
            pointerEvents: 'none',
          }}
        />

        {/* Brand mark */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14H11v-4H7v-2h4V6h2v4h4v2h-4v4z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                SAMSTACK AI
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                Healthcare Platform
              </div>
            </div>
          </div>
        </div>

        {/* Main message */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.04em',
              lineHeight: 1.15,
              marginBottom: 16,
            }}
          >
            The operating system for modern healthcare.
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, maxWidth: 320 }}>
            Manage patients, appointments, consultations, and billing — from a single, secure workspace.
          </p>

          {/* Trust indicators */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
            {TRUST_BADGES.map(b => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {b.icon}
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500, letterSpacing: '0.03em' }}>
            © 2026 SAMSTACK AI. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel — login form ─────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 420 }}>
          {/* Mobile brand (hidden on desktop) */}
          <div
            className="show-mobile-only"
            style={{ display: 'none', marginBottom: 32, textAlign: 'center' }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0d9488, #0891b2)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14H11v-4H7v-2h4V6h2v4h4v2h-4v4z"/>
              </svg>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
              SAMSTACK AI
            </div>
          </div>

          {/* Form header */}
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.03em',
                marginBottom: 6,
              }}
            >
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
              Sign in to your secure healthcare workspace.
            </p>
          </div>

          {/* Form card */}
          <div
            className="card"
            style={{ padding: '28px 28px 24px' }}
          >
            {/* Error alert */}
            {error && (
              <div style={{ marginBottom: 20 }}>
                <Alert variant="error" onDismiss={() => setError('')}>
                  {error}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label htmlFor="login-email" className="form-label">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 24 }}>
                <label htmlFor="login-password" className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--color-text-muted)',
                      padding: '2px 4px',
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'color 150ms',
                    }}
                  >
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{ width: '100%', justifyContent: 'center', padding: '11px 20px', fontSize: 14 }}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Secure workspace note */}
            <p
              style={{
                textAlign: 'center',
                fontSize: 11.5,
                color: 'var(--color-text-muted)',
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <LockIcon />
              Secure, encrypted healthcare workspace
            </p>
          </div>

          {/* Dev role presets — visible in development only */}
          {IS_DEV && (
            <div
              style={{
                marginTop: 20,
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <p
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--color-text-muted)',
                  marginBottom: 10,
                  textAlign: 'center',
                }}
              >
                Dev — Quick access
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {DEV_PRESETS.map(p => (
                  <button
                    key={p.label}
                    onClick={() => preset(p.email, p.pass)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11.5, justifyContent: 'center' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────
const TRUST_BADGES = [
  {
    label: 'Role-based access control',
    icon: (
      <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.8)" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'End-to-end encrypted patient data',
    icon: (
      <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.8)" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    label: 'Audit trails on all clinical records',
    icon: (
      <svg width="14" height="14" fill="none" stroke="rgba(255,255,255,0.8)" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
]

const DEV_PRESETS = [
  { label: 'Admin',     email: 'admin@samstack.ai',     pass: 'AdminPass123!' },
  { label: 'Doctor',    email: 'doctor@samstack.ai',    pass: 'DoctorPass123!' },
  { label: 'Reception', email: 'reception@samstack.ai', pass: 'ReceptPass123!' },
]

// ── Inline icons ──────────────────────────────────────────────────────────────
function EyeIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}
function LockIcon() {
  return (
    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}