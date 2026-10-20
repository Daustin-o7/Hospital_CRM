import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Alert, friendlyError } from '../components/ui/Alert'
import { BrandLogo } from '../components/ui/BrandLogo'

export default function ChangePassword() {
  const { changePassword, logout, user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (next.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('The new passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await changePassword(current, next)
    } catch (err: any) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BrandLogo size="lg" theme="auto" organizationName="SAMSTACK AI" tagline="Clinical Operating System" />
        </div>
        <div className="card p-7">
          <h1 className="text-lg font-bold text-[var(--color-text)] font-heading">Choose a new password</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1 mb-6">
            {user?.email ? `Signed in as ${user.email}. ` : ''}
            This account is using a temporary password and must set its own before continuing.
          </p>

          {error && (
            <div className="mb-5">
              <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="cp-current" className="form-label">Temporary password</label>
              <input
                id="cp-current"
                type="password"
                className="form-input"
                value={current}
                onChange={e => setCurrent(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="cp-new" className="form-label">New password</label>
              <input
                id="cp-new"
                type="password"
                className="form-input"
                value={next}
                onChange={e => setNext(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="cp-confirm" className="form-label">Confirm new password</label>
              <input
                id="cp-confirm"
                type="password"
                className="form-input"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={loading}
              />
            </div>

            <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Saving…' : 'Save new password'}
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
