import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'

interface QueueState {
  currentlyServing: number
  yourToken: number
}

export default function QueueStatus() {
  const { token = '' } = useParams()
  const [state, setState] = useState<QueueState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)
  const timer = useRef<number | null>(null)
  const alive = useRef(true)

  const fetchStatus = useCallback(async (quiet = false) => {
    try {
      const res = await api.get(`/queue-status/${encodeURIComponent(token)}`)
      if (!alive.current) return
      setState(res.data)
      setError(null)
      setUpdatedAt(new Date())
    } catch (err) {
      if (!alive.current) return
      const code = (err as { response?: { status?: number } })?.response?.status
      if (!quiet) setError(code === 404 ? 'token_not_found' : 'network')
    } finally {
      if (alive.current && timer.current === null) {
        timer.current = window.setInterval(() => fetchStatus(true), 10000)
      }
    }
  }, [token])

  useEffect(() => {
    alive.current = true
    fetchStatus()
    return () => {
      alive.current = false
      if (timer.current !== null) window.clearInterval(timer.current)
      timer.current = null
    }
  }, [fetchStatus])

  const shell = (children: React.ReactNode) => (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #0f172a 0%, #134e4a 55%, #0d9488 100%)' }}
    >
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-teal-50 text-xs font-bold tracking-wide mb-5">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-300 animate-pulse"></span>
          Live Queue Status
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xl">
          {children}
        </div>
        <p className="text-slate-400 text-xs mt-4">Refreshes automatically every 10 seconds</p>
      </div>
    </div>
  )

  if (error === 'token_not_found') {
    return shell(
      <div className="py-6 space-y-3">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
          <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Token not found</h1>
        <p className="text-sm text-slate-600">
          This queue link doesn't match any appointment. Please check the token on your slip, or ask at reception.
        </p>
      </div>
    )
  }

  if (error === 'network') {
    return shell(
      <div className="py-6 space-y-3">
        <h1 className="text-lg font-bold text-slate-800" style={{ fontFamily: 'Outfit, sans-serif' }}>Connection problem</h1>
        <p className="text-sm text-slate-600">Couldn't reach the clinic system. Retrying shortly.</p>
        <button onClick={() => { setError(null); fetchStatus() }} className="btn btn-secondary btn-sm cursor-pointer">
          Try now
        </button>
      </div>
    )
  }

  if (!state) {
    return shell(
      <div className="py-10 space-y-4 animate-pulse">
        <div className="h-4 w-32 mx-auto rounded bg-slate-200"></div>
        <div className="h-16 w-40 mx-auto rounded-lg bg-slate-200"></div>
        <div className="h-4 w-44 mx-auto rounded bg-slate-100"></div>
      </div>
    )
  }

  const ahead = Math.max(0, state.yourToken - state.currentlyServing)
  const yourTurn = ahead === 0

  return shell(
    <div className="py-4 space-y-5">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Now serving</div>
        <div className="text-5xl font-extrabold text-teal-700 tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
          #{state.currentlyServing}
        </div>
      </div>

      <div className={`rounded-lg border p-4 ${yourTurn ? 'bg-teal-50 border-teal-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Your token</div>
        <div className="text-3xl font-extrabold text-slate-800 tabular-nums" style={{ fontFamily: 'Outfit, sans-serif' }}>
          #{state.yourToken}
        </div>
        <div className={`text-sm font-bold mt-1 ${yourTurn ? 'text-teal-700' : 'text-slate-600'}`}>
          {yourTurn ? "It's your turn — please go in" : `${ahead} ahead of you`}
        </div>
      </div>

      <div className="text-[11px] text-slate-400">
        {updatedAt
          ? `Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
          : 'Loading…'}
      </div>
    </div>
  )
}
