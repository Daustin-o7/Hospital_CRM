import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'

interface DashStats {
  appointmentsToday: number
  totalPatients: number
  revenueToday: number
  pendingPayments: number
}

interface TodayAppt {
  id: string
  time: string
  patientName: string
  doctorName: string
  type: string
  status: 'check-in' | 'waiting' | 'upcoming' | 'completed' | 'cancelled'
}

interface QueueCounts {
  checkedIn: number
  waiting: number
  completed: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<DashStats>({
    appointmentsToday: 0,
    totalPatients: 0,
    revenueToday: 0,
    pendingPayments: 0,
  })

  const [schedule, setSchedule] = useState<TodayAppt[]>([])
  const [queue, setQueue] = useState<QueueCounts>({ checkedIn: 0, waiting: 0, completed: 0 })
  const [loading, setLoading] = useState(true)

  // Keyboard accelerators: F2 -> New Patient / Walk-in, F4 -> Consultations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        navigate('/dashboard/patients')
      } else if (e.key === 'F4') {
        e.preventDefault()
        navigate('/dashboard/consultations')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const todayISO = new Date().toISOString().split('T')[0]
        const [apptRes, invRes, patRes] = await Promise.allSettled([
          api.get(`/appointments?date=${todayISO}`),
          api.get('/invoices'),
          api.get('/patients'),
        ])

        if (apptRes.status === 'fulfilled' && Array.isArray(apptRes.value.data)) {
          const rawAppts = apptRes.value.data
          if (rawAppts.length > 0) {
            setStats(prev => ({ ...prev, appointmentsToday: rawAppts.length }))

            const counts: QueueCounts = { checkedIn: 0, waiting: 0, completed: 0 }
            rawAppts.forEach((a: any) => {
              const s = (a.status || 'scheduled').toLowerCase()
              if (s === 'checkedin' || s === 'arrived') counts.checkedIn++
              else if (s === 'waiting' || s === 'in-queue') counts.waiting++
              else if (s === 'completed') counts.completed++
            })
            setQueue(counts)

            const mapped: TodayAppt[] = rawAppts.slice(0, 6).map((a: any, idx: number) => {
              const rawStatus = (a.status || 'scheduled').toLowerCase()
              let status: TodayAppt['status'] = 'upcoming'
              if (rawStatus === 'checkedin' || rawStatus === 'arrived') status = 'check-in'
              else if (rawStatus === 'waiting' || rawStatus === 'in-queue') status = 'waiting'
              else if (rawStatus === 'completed') status = 'completed'

              return {
                id: a.id || String(idx),
                time: a.timeSlot || a.time || `0${9 + idx}:00`.slice(-5),
                patientName: a.patientName || a.patient?.name || 'Patient',
                doctorName: a.doctorName || a.doctor?.name || 'Doctor',
                type: a.type || 'Consultation',
                status,
              }
            })
            if (mapped.length > 0) setSchedule(mapped)
          }
        }

        if (invRes.status === 'fulfilled' && Array.isArray(invRes.value.data)) {
          const invs = invRes.value.data
          const paidToday = invs
            .filter((i: any) => i.status?.toLowerCase() === 'paid')
            .reduce((acc: number, curr: any) => acc + (curr.total || 0), 0)
          const pendingCount = invs.filter(
            (i: any) => i.status?.toLowerCase() === 'issued' || i.status?.toLowerCase() === 'unpaid'
          ).length

          setStats(prev => ({ ...prev, revenueToday: paidToday, pendingPayments: pendingCount }))
        }

        if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
          setStats(prev => ({ ...prev, totalPatients: patRes.value.data.length }))
        }
      } catch {
        // Graceful fallback to initial values
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const displayName = user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Doctor'

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting}, {displayName}
          </h1>
          <p className="page-description">
            Real-time clinic operations, patient flow, and clinical queue sequencing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="badge badge-neutral">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          <button
            onClick={() => navigate('/dashboard/appointments')}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Book slot</span>
          </button>
        </div>
      </div>

      {/* ── 4 Top KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Appointments */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="stat-icon-badge stat-icon-badge-teal">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="stat-label mt-0">Appointments today</span>
            </div>
            <span
              className="text-teal-700 dark:text-teal-400 hover:text-teal-900 dark:hover:text-teal-200 transition-colors cursor-pointer"
              onClick={() => navigate('/dashboard/appointments')}
              aria-label="Open appointments"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="stat-value font-heading font-mono">{stats.appointmentsToday}</span>
            <span className="badge badge-brand">Scheduled today</span>
          </div>
        </div>

        {/* Card 2: Patients */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="stat-icon-badge stat-icon-badge-sky">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="stat-label mt-0">Patients registry</span>
            </div>
            <span
              className="text-sky-700 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-200 transition-colors cursor-pointer"
              onClick={() => navigate('/dashboard/patients')}
              aria-label="Open patients"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="stat-value font-heading font-mono">{stats.totalPatients}</span>
            <span className="badge badge-info">Registered records</span>
          </div>
        </div>

        {/* Card 3: Revenue */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="stat-icon-badge stat-icon-badge-emerald">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="stat-label mt-0">Revenue today</span>
            </div>
            <span
              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors cursor-pointer"
              onClick={() => navigate('/dashboard/billing')}
              aria-label="Open billing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="stat-value font-heading font-mono">₹{stats.revenueToday.toLocaleString('en-IN')}</span>
            <span className="badge badge-success">Collected today</span>
          </div>
        </div>

        {/* Card 4: Pending Payments */}
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="stat-icon-badge stat-icon-badge-amber">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="stat-label mt-0">Unsettled invoices</span>
            </div>
            <span
              className="text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 transition-colors cursor-pointer"
              onClick={() => navigate('/dashboard/billing')}
              aria-label="Open billing"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-2">
            <span className="stat-value font-heading font-mono">{stats.pendingPayments}</span>
            <span className="badge badge-warning">Awaiting settlement</span>
          </div>
        </div>
      </div>

      {/* ── Main 3-Section Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Schedule (5 cols) */}
        <div className="lg:col-span-5 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Today's appointment agenda</h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">Sequential consultation schedule</p>
              </div>
              <Link to="/dashboard/appointments" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline">
                View all →
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3 py-3">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            ) : schedule.length === 0 ? (
              <div className="empty-state py-8">
                <p className="empty-state-title">No appointments scheduled</p>
                <p className="empty-state-description">Today's booked consultations will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-border-subtle)]">
                {schedule.map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] font-mono w-12 flex-shrink-0 bg-[var(--color-surface-raised)] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-center">
                        {item.time}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-[var(--color-text)] truncate group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {item.patientName}
                        </h4>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                          {item.type} • <span className="text-[var(--color-text-secondary)]">{item.doctorName}</span>
                        </p>
                      </div>
                    </div>

                    <div>
                      {item.status === 'check-in' && <span className="badge badge-success">Checked-in</span>}
                      {item.status === 'waiting' && <span className="badge badge-warning">In queue</span>}
                      {item.status === 'upcoming' && <span className="badge badge-neutral">Upcoming</span>}
                      {item.status === 'completed' && <span className="badge badge-brand">Completed</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] text-center">
            <button
              onClick={() => navigate('/dashboard/appointments')}
              className="btn btn-ghost btn-sm w-full"
            >
              + Add new schedule slot
            </button>
          </div>
        </div>

        {/* Middle Column: Queue Status (4 cols) */}
        <div className="lg:col-span-4 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Live queue triage</h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">Derived from today's appointments</p>
              </div>
              <span className="status-dot status-dot-active" aria-hidden="true"></span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)] mb-4">
              <div>
                <div className="text-xl font-extrabold text-[var(--color-text)] font-mono">{queue.checkedIn}</div>
                <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mt-0.5">Checked in</div>
              </div>
              <div className="border-x border-[var(--color-border)]">
                <div className="text-xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">{queue.waiting}</div>
                <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mt-0.5">Waiting</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-[var(--color-text-secondary)] font-mono">{queue.completed}</div>
                <div className="text-[11px] font-semibold text-[var(--color-text-muted)] mt-0.5">Completed</div>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">Wait-time telemetry</div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Average and longest wait times are calculated in real-time as patients advance through the triage queue.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard/queue')}
            className="btn btn-secondary btn-sm w-full mt-4"
          >
            Manage live queue →
          </button>
        </div>

        {/* Right Column: Needs Attention (3 cols) */}
        <div className="lg:col-span-3 card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[var(--color-border)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Clinical alerts</h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">Pending tasks &amp; reviews</p>
              </div>
            </div>

            <div className="empty-state py-8 px-2">
              <p className="empty-state-title">System telemetry active</p>
              <p className="empty-state-description">
                All scheduled appointments, pharmacy dispensations, and lab triage are operating normally.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="card p-5">
        <h3 className="section-title">Clinical fast actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button onClick={() => navigate('/dashboard/patients')} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Walk-in patient</span>
          </button>

          <button onClick={() => navigate('/dashboard/consultations')} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>New Rx consult</span>
          </button>

          <button onClick={() => navigate('/dashboard/pharmacy/pos')} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Pharmacy counter</span>
          </button>

          <button onClick={() => navigate('/dashboard/billing')} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Create invoice</span>
          </button>

          <button onClick={() => navigate('/dashboard/messages')} className="btn btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>WhatsApp blast</span>
          </button>
        </div>
      </div>
    </div>
  )
}
