import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('doctor@samstack.ai')
  const [password, setPassword] = useState('DoctorPass123!')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication credentials failed. Enter email & password.')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail)
    setPassword(rolePass)
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#070c18]">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="relative w-full max-w-md glass-panel p-8 sm:p-10 border-slate-800 space-y-6 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white font-bold text-2xl shadow-lg shadow-teal-500/30">
            +
          </div>
          <h1 className="text-2xl font-bold text-white font-heading">SamStack AI</h1>
          <p className="text-xs text-teal-400 font-semibold uppercase tracking-wider">Doctor & Clinic CRM (Phase 1)</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field font-mono text-sm"
              placeholder="user@samstack.ai"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field text-sm"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <span>Sign In to EMR Dashboard &rarr;</span>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-800 space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-400 text-center">Quick Role Access Presets</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => applyPreset('admin@samstack.ai', 'AdminPass123!')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-teal-500/50"
            >
              Clinic Admin
            </button>
            <button
              onClick={() => applyPreset('doctor@samstack.ai', 'DoctorPass123!')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-teal-300 border-teal-500/30"
            >
              Doctor
            </button>
            <button
              onClick={() => applyPreset('reception@samstack.ai', 'ReceptPass123!')}
              className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white hover:border-teal-500/50"
            >
              Receptionist
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}