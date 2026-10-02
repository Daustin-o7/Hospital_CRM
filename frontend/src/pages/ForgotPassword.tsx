import { useState } from 'react'
import { Link } from 'react-router-dom'
import { friendlyError } from '../components/ui/Alert'
import api from '../services/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [devToken, setDevToken] = useState<string | null>(null)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setError('')
    setSending(true)
    try {
      const res = await api.post('/auth/request-password-reset', { email: email.trim() })
      setSent(true)
      // Backend returns the raw token until email delivery is wired (local dev)
      setDevToken(res.data?.resetToken ?? null)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0d9488 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-white text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Forgot your password?
          </h1>
          <p className="text-slate-300 text-sm mt-1.5">
            We'll issue a reset link for your account email.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-700">
                If an account exists for <strong>{email}</strong>, a reset link has been issued.
                It expires in 1 hour.
              </p>
              {devToken && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                    Local development
                  </div>
                  <div className="text-xs text-amber-800 mt-1">
                    Email delivery isn't configured, so your reset token is shown here.
                  </div>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                    className="btn btn-primary btn-sm w-full justify-center mt-2 cursor-pointer"
                  >
                    Continue to reset password
                  </Link>
                </div>
              )}
              <Link to="/login" className="text-sm text-teal-700 font-semibold hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="alert alert-error">{error}</div>}
              <div>
                <label className="form-label" htmlFor="fp-email">Account email</label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@clinic.com"
                  className="form-input"
                  style={{ fontSize: 16 }}
                  autoFocus
                />
              </div>
              <button type="submit" disabled={sending} className="btn btn-primary w-full justify-center cursor-pointer">
                {sending ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
              <p className="text-center text-sm text-slate-500">
                Remembered it? <Link to="/login" className="text-teal-700 font-semibold hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
