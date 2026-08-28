import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Skeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { AppointmentBadge } from '../components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────
interface DashStats {
  totalPatients: number
  appointmentsToday: number
  revenueToday: number
  pendingPayments: number
}

interface TodayAppt {
  id: string
  time: string
  patientName: string
  doctorName?: string
  type: string
  status: string
  tokenNumber?: number
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: 'User', role: 'doctor' }
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<DashStats>({
    totalPatients: 0, appointmentsToday: 0, revenueToday: 0, pendingPayments: 0,
  })
  const [todayAppts, setTodayAppts] = useState<TodayAppt[]>([])
  const [loading, setLoading] = useState(true)
  const user = getStoredUser()
  const rawRole = String(user?.role || 'doctor').toLowerCase()

  useEffect(() => {
    const fetch = async () => {
      try {
        const todayISO = new Date().toISOString().split('T')[0]
        const [apptRes, invoiceRes] = await Promise.allSettled([
          api.get<any[]>(`/v1/appointments?date=${todayISO}`),
          api.get<any[]>('/v1/invoices'),
        ])

        const appts = apptRes.status === 'fulfilled' ? apptRes.value.data ?? [] : []
        const invoices = invoiceRes.status === 'fulfilled' ? invoiceRes.value.data ?? [] : []

        const revenueToday = invoices
          .filter((inv: any) => inv.status?.toLowerCase() === 'paid' && inv.createdAt?.startsWith(todayISO))
          .reduce((s: number, inv: any) => s + (inv.total || 0), 0)

        const pendingPayments = invoices
          .filter((inv: any) => ['pending', 'overdue'].includes(inv.status?.toLowerCase()))
          .reduce((s: number, inv: any) => s + (inv.total || 0), 0)

        const mapped: TodayAppt[] = appts.map((a: any) => ({
          id: a.id,
          time: a.scheduledTime?.slice(0, 5) ?? '—',
          patientName: a.patientName ?? a.patient?.fullName ?? 'Unknown',
          doctorName: a.doctorName ?? a.doctor?.name,
          type: a.appointmentType ?? 'Consultation',
          status: a.status ?? 'scheduled',
          tokenNumber: a.tokenNumber,
        }))

        setStats(prev => ({
          ...prev,
          appointmentsToday: appts.length,
          revenueToday,
          pendingPayments,
        }))
        setTodayAppts(mapped)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const STAT_CARDS = [
    {
      id: 'appointments',
      label: "Today's appointments",
      value: loading ? null : stats.appointmentsToday,
      unit: 'scheduled',
      icon: CalendarIcon,
      href: '/dashboard/appointments',
      accent: 'var(--brand-primary)',
    },
    {
      id: 'revenue',
      label: 'Revenue today',
      value: loading ? null : formatINR(stats.revenueToday),
      unit: 'collected',
      icon: RupeeIcon,
      href: '/dashboard/billing',
      accent: '#16a34a',
    },
    {
      id: 'pending',
      label: 'Pending payments',
      value: loading ? null : formatINR(stats.pendingPayments),
      unit: 'outstanding',
      icon: ClockIcon,
      href: '/dashboard/billing',
      accent: '#d97706',
    },
    {
      id: 'queue',
      label: 'Queue now',
      value: loading ? null : todayAppts.filter(a => ['checkedin','checked-in','inprogress'].includes(a.status.toLowerCase())).length,
      unit: 'waiting',
      icon: QueueIcon,
      href: '/dashboard/queue',
      accent: 'var(--brand-secondary)',
    },
  ]

  const upcomingAppts = todayAppts.filter(a => !['completed','cancelled'].includes(a.status.toLowerCase()))
  const completedAppts = todayAppts.filter(a => a.status.toLowerCase() === 'completed')

  return (
    <div className="animate-fadein">

      {/* ── Greeting ─────────────────────────────────────── */}
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
          {formatDate()}
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
          {getGreeting()}, {user?.name?.split(' ')[0] ?? 'Doctor'} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Here's what's happening at your clinic today.
        </p>
      </div>

      {/* ── KPI Stat Cards ────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {STAT_CARDS.map(card => (
          <Link
            key={card.id}
            to={card.href}
            style={{ textDecoration: 'none' }}
            aria-label={`${card.label}: ${card.value}`}
          >
            <div className="stat-card card-hover">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: `${card.accent}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.accent,
                  }}
                >
                  <card.icon />
                </div>
                <svg width="14" height="14" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>

              {loading ? (
                <>
                  <Skeleton height={32} width={80} />
                  <div style={{ marginTop: 6 }}>
                    <Skeleton height={12} width={100} />
                  </div>
                </>
              ) : (
                <>
                  <div className="stat-value">{card.value ?? '—'}</div>
                  <div className="stat-label">{card.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{card.unit}</div>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* ── Two-column layout ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 20 }}>

        {/* ── Today's Schedule ── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Today's schedule
            </h2>
            <Link
              to="/dashboard/appointments"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand-primary)', textDecoration: 'none' }}
            >
              View all →
            </Link>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            {loading ? (
              <div style={{ padding: '4px 0' }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                    <Skeleton width={40} height={14} />
                    <div style={{ flex: 1 }}>
                      <Skeleton width={140} height={14} />
                      <div style={{ marginTop: 6 }}>
                        <Skeleton width={90} height={11} />
                      </div>
                    </div>
                    <Skeleton width={60} height={20} radius="9999px" />
                  </div>
                ))}
              </div>
            ) : upcomingAppts.length === 0 ? (
              <EmptyState
                icon={
                  <svg style={{ width: 40, height: 40 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
                title="No upcoming appointments"
                description="All appointments for today are completed, or none were scheduled."
              />
            ) : (
              upcomingAppts.map((appt, i) => (
                <div
                  key={appt.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '13px 20px',
                    borderBottom: i < upcomingAppts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                >
                  {/* Time */}
                  <div
                    style={{
                      width: 48,
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: 'var(--color-text-secondary)',
                      flexShrink: 0,
                    }}
                  >
                    {appt.time}
                  </div>

                  {/* Divider dot */}
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-border)', flexShrink: 0 }} />

                  {/* Patient info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {appt.patientName}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>
                      {appt.type}
                      {appt.doctorName && rawRole === 'clinicadmin' && ` · ${appt.doctorName}`}
                    </div>
                  </div>

                  {/* Token */}
                  {appt.tokenNumber && (
                    <div className="queue-token" title={`Token #${appt.tokenNumber}`}>
                      {appt.tokenNumber}
                    </div>
                  )}

                  {/* Status badge */}
                  <AppointmentBadge status={appt.status} />
                </div>
              ))
            )}
          </div>

          {/* Completed count */}
          {!loading && completedAppts.length > 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 10, fontWeight: 500 }}>
              ✓ {completedAppts.length} appointment{completedAppts.length > 1 ? 's' : ''} completed today
            </p>
          )}
        </div>

        {/* ── Quick Actions ── */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.02em', marginBottom: 14 }}>
            Quick actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {QUICK_ACTIONS.filter(a => a.roles.includes(rawRole)).map(action => (
              <Link
                key={action.label}
                to={action.href}
                style={{ textDecoration: 'none' }}
              >
                <div
                  className="card"
                  style={{
                    padding: '13px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'box-shadow 150ms, border-color 150ms, transform 150ms',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.boxShadow = 'var(--shadow-md)'
                    el.style.transform = 'translateY(-1px)'
                    el.style.borderColor = '#cbd5e1'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.boxShadow = ''
                    el.style.transform = ''
                    el.style.borderColor = ''
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 'var(--radius-md)',
                      background: `${action.color}16`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: action.color,
                      flexShrink: 0,
                    }}
                  >
                    <action.icon />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{action.label}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)' }}>{action.description}</div>
                  </div>
                  <svg width="14" height="14" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Quick actions config ───────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    label: 'Book appointment',
    description: 'Schedule a new OPD visit',
    href: '/dashboard/appointments',
    color: 'var(--brand-primary)',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: CalendarIcon,
  },
  {
    label: 'Register patient',
    description: 'Add a new patient record',
    href: '/dashboard/patients',
    color: '#0891b2',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: PatientIcon,
  },
  {
    label: 'View queue',
    description: 'Manage today\'s live queue',
    href: '/dashboard/queue',
    color: '#7c3aed',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: QueueIcon,
  },
  {
    label: 'Create invoice',
    description: 'Generate billing for a patient',
    href: '/dashboard/billing',
    color: '#16a34a',
    roles: ['clinicadmin', 'receptionist'],
    icon: BillingIcon,
  },
  {
    label: 'New consultation',
    description: 'Record clinical notes',
    href: '/dashboard/consultations',
    color: '#d97706',
    roles: ['doctor', 'clinicadmin'],
    icon: ConsultIcon,
  },
]

// ── Icons ─────────────────────────────────────────────────────────────────────
function CalendarIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function RupeeIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 8h6M9 12h6m-6 4h6M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function ClockIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function QueueIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 6h16M4 10h16M4 14h8m-8 4h4" />
    </svg>
  )
}
function PatientIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  )
}
function BillingIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}
function ConsultIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}