import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { friendlyError } from '../components/ui/Alert'
import api from '../services/api'

const ERROR_MESSAGES: Record<string, string> = {
  invalid_token: 'This invite link is invalid or has already been used. Ask your clinic admin to send a new one.',
  expired_invite: 'This invite has expired. Ask your clinic admin to send a new one.',
  invite_expired: 'This invite has expired. Ask your clinic admin to send a new one.',
}

export default function AcceptInvite() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setSaving(true)
    try {
      await api.post('/staff/accept-invite', { inviteToken: token, password })
      setDone(true)
    } catch (err) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(code && ERROR_MESSAGES[code] ? ERROR_MESSAGES[code] : friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0d9488 100%)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-teal-50 text-xs font-bold tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
            Team Invitation
          </div>
          <h1 className="text-white text-xl font-bold mt-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Join your clinic's workspace
          </h1>
          <p className="text-slate-300 text-sm mt-1.5">
            Set your password to activate your account.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl">
          {done ? (
            <div className="space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-slate-700 font-semibold">Account activated — welcome aboard!</p>
              <Link to="/login" className="btn btn-primary w-full justify-center cursor-pointer">
                Sign in
              </Link>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-slate-700">
                This page needs an invite token. Use the link from your invitation email.
              </p>
              <Link to="/login" className="btn btn-secondary w-full justify-center cursor-pointer">
                Go to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="alert alert-error">{error}</div>}
              <div>
                <label className="form-label" htmlFor="ai-pass">Choose a password</label>
                <input
                  id="ai-pass"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="form-input"
                  style={{ fontSize: 16 }}
                  autoFocus
                />
              </div>
              <div>
                <label className="form-label" htmlFor="ai-confirm">Confirm password</label>
                <input
                  id="ai-confirm"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat the password"
                  className="form-input"
                  style={{ fontSize: 16 }}
                />
              </div>
              <button type="submit" disabled={saving} className="btn btn-primary w-full justify-center cursor-pointer">
                {saving ? (
                  <>
                    <span className="spinner spinner-sm" />
                    Activating…
                  </>
                ) : (
                  'Activate account'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
