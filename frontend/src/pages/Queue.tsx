import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { AppointmentBadge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

interface QueueEntry {
  appointmentId: string
  tokenNumber: number
  patientName: string
  doctorName: string
  status: string
  checkedInAt?: string
  waitMinutes?: number
}

function fmt12(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

export default function Queue() {
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchQueue = useCallback(async () => {
    try {
      const todayISO = new Date().toISOString().split('T')[0]
      const res = await api.get(`/v1/appointments?date=${todayISO}`)
      const all = Array.isArray(res.data) ? res.data : []
      const queued = all
        .filter((a: any) => ['checked_in', 'checkedin', 'inprogress', 'booked', 'scheduled'].includes(String(a.status).toLowerCase()))
        .map((a: any) => ({
          appointmentId: a.appointmentId ?? a.id,
          tokenNumber: a.tokenNumber ?? a.queueToken ?? 0,
          patientName: a.patientName ?? a.patient?.fullName ?? 'Unknown',
          doctorName: a.doctorName ?? a.doctor?.name ?? '—',
          status: a.status ?? 'scheduled',
          checkedInAt: a.checkedInAt,
          waitMinutes: a.waitMinutes,
        }))
        .sort((a: QueueEntry, b: QueueEntry) => (a.tokenNumber || 0) - (b.tokenNumber || 0))
      setQueue(queued)
    } catch {
      setQueue([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleCallNext = async (entry: QueueEntry) => {
    try {
      await api.post(`/v1/appointments/${entry.appointmentId}/start`)
      setQueue(prev => prev.map(e =>
        e.appointmentId === entry.appointmentId ? { ...e, status: 'inprogress' } : e
      ))
    } catch {}
  }

  const handleComplete = async (entry: QueueEntry) => {
    try {
      await api.post(`/v1/appointments/${entry.appointmentId}/complete`)
      setQueue(prev => prev.filter(e => e.appointmentId !== entry.appointmentId))
    } catch {}
  }

  useEffect(() => {
    fetchQueue()
  }, [fetchQueue])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchQueue])

  const waiting   = queue.filter(e => ['booked', 'scheduled', 'checked_in', 'checkedin'].includes(e.status.toLowerCase()))
  const inSession = queue.filter(e => e.status.toLowerCase() === 'inprogress')
  const nextToken = waiting.length > 0 ? Math.min(...waiting.map(e => e.tokenNumber || 0)) : null

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Queue</h1>
          <p className="page-description">Today's OPD queue — real-time patient flow management.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 500, color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ accentColor: 'var(--brand-primary)', width: 14, height: 14 }}
            />
            Auto-refresh (30s)
          </label>
          <button className="btn btn-secondary btn-sm" onClick={fetchQueue}>
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Waiting', value: loading ? '—' : waiting.length, color: 'var(--color-warning)' },
          { label: 'In session', value: loading ? '—' : inSession.length, color: 'var(--brand-primary)' },
          { label: 'Next token', value: loading ? '—' : (nextToken ?? '—'), color: 'var(--color-info)' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── In session highlight ── */}
      {inSession.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              padding: '14px 20px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--brand-primary-10)',
              border: '1px solid var(--brand-primary-20)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span className="queue-token" style={{ fontSize: 16, width: 40, height: 40 }}>
              {inSession[0].tokenNumber}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                {inSession[0].patientName}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>
                In session with {inSession[0].doctorName}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <span className="status-dot status-dot-active" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-primary)' }}>In progress</span>
            </div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleComplete(inSession[0])}
              aria-label="Complete consultation"
            >
              Complete
            </button>
          </div>
        </div>
      )}

      {/* ── Waiting queue table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr><th>Token</th><th>Patient</th><th>Doctor</th><th>Checked in</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}</tbody>
          </table>
        ) : waiting.length === 0 && inSession.length === 0 ? (
          <EmptyState
            icon={
              <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M4 6h16M4 10h16M4 14h8m-8 4h4" />
              </svg>
            }
            title="Queue is empty"
            description="No patients are currently checked in. Check-in patients from the Appointments page."
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Live queue">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Checked in</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {waiting.map(entry => (
                  <tr key={entry.appointmentId}>
                    <td>
                      <span className="queue-token">{entry.tokenNumber || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{entry.patientName}</span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{entry.doctorName}</td>
                    <td style={{ color: 'var(--color-text-muted)' }} className="mono">
                      {fmt12(entry.checkedInAt)}
                    </td>
                    <td><AppointmentBadge status={entry.status} /></td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleCallNext(entry)}
                        aria-label={`Call token ${entry.tokenNumber}`}
                        style={{ fontSize: 12, padding: '5px 12px' }}
                      >
                        Call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
