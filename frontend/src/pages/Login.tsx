import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
      setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const applyPreset = (roleEmail: string, rolePass: string) => {
    setEmail(roleEmail)
    setPassword(rolePass)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #f0fdfa 50%, #eff6ff 100%)',
      }}
    >
      <div className="w-full max-w-md card p-8 sm:p-10 space-y-6 shadow-xl border-slate-200">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white font-bold text-2xl shadow-lg">
            +
          </div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>SamStack AI</h1>
          <p className="text-xs text-teal-600 font-bold uppercase tracking-wider">Doctor &amp; Clinic CRM · Phase 1</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field mono"
              placeholder="doctor@samstack.ai"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field pr-10"
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full justify-center py-3"
          >
            {loading ? 'Authenticating...' : 'Sign In to EMR Dashboard →'}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 space-y-2">
          <p className="text-xs font-bold uppercase text-slate-400 text-center">Quick Role Access (Dev Presets)</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => applyPreset('admin@samstack.ai', 'AdminPass123!')}
              className="px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors font-medium"
            >
              Admin
            </button>
            <button
              onClick={() => applyPreset('doctor@samstack.ai', 'DoctorPass123!')}
              className="px-2 py-2 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-700 font-semibold"
            >
              Doctor
            </button>
            <button
              onClick={() => applyPreset('reception@samstack.ai', 'ReceptPass123!')}
              className="px-2 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 transition-colors font-medium"
            >
              Reception
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}