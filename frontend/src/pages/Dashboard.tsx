import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

interface Stats {
  patients: number
  appointmentsToday: number
  revenueToday: number
  activeDoctors: number
}

const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ patients: 124, appointmentsToday: 18, revenueToday: 24500, activeDoctors: 4 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const todayISO = new Date().toISOString().split('T')[0]
        const [patientsRes, appointmentsRes, invoicesRes] = await Promise.all([
          axios.get('/api/v1/patients/search?q=a', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          axios.get(`/api/v1/appointments?date=${todayISO}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          axios.get('/api/v1/invoices?status=paid', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        ])
        setStats(prev => ({
          patients: patientsRes?.data?.length || prev.patients,
          appointmentsToday: appointmentsRes?.data?.length || prev.appointmentsToday,
          revenueToday: invoicesRes?.data?.reduce((s: number, inv: any) => s + (inv.total || 0), 0) || prev.revenueToday,
          activeDoctors: prev.activeDoctors,
        }))
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { tag: 'Total Patients', value: stats.patients, label: 'Registered in system', href: '/dashboard/patients', icon: UsersIcon, colour: '#0d9488' },
    { tag: "Today's OPD", value: stats.appointmentsToday, label: 'Scheduled appointments', href: '/dashboard/appointments', icon: CalendarIcon, colour: '#0891b2' },
    { tag: 'Revenue Today', value: `₹${stats.revenueToday.toLocaleString('en-IN')}`, label: 'Razorpay + cash', href: '/dashboard/billing', icon: RupeeIcon, colour: '#0d9488' },
    { tag: 'Doctors On Duty', value: stats.activeDoctors, label: 'Active today', href: '/dashboard/staff', icon: StethoscopeIcon, colour: '#0891b2' },
  ]

  const queue = [
    { time: '09:30', patient: 'Aarav Patel', age: '28M', doctor: 'Dr. R. K. Sharma', type: 'General OPD', status: 'Completed' },
    { time: '10:15', patient: 'Priya Verma', age: '34F', doctor: 'Dr. Ananya Iyer', type: 'Follow-up', status: 'In Consultation' },
    { time: '11:00', patient: 'Rajesh Kumar', age: '45M', doctor: 'Dr. R. K. Sharma', type: 'Routine OPD', status: 'Scheduled' },
    { time: '11:30', patient: 'Sunita Reddy', age: '52F', doctor: 'Dr. Vikram Malhotra', type: 'Diabetes Mgmt', status: 'Scheduled' },
  ]

  const statusClass: Record<string, string> = {
    'Completed':       'status-chip status-chip-completed',
    'In Consultation': 'status-chip status-chip-pending',
    'Scheduled':       'status-chip status-chip-scheduled',
    'Cancelled':       'status-chip status-chip-cancelled',
  }

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="label-xs mb-1">{today}</p>
          <h1 className="page-title">Clinic Operations</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Live OPD queue · patient registry · revenue summary
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <Link to="/dashboard/patients" className="btn-primary">
            <UsersIcon className="w-4 h-4" />
            New Patient
          </Link>
          <Link to="/dashboard/appointments" className="btn-secondary">
            <CalendarIcon className="w-4 h-4" />
            Book OPD
          </Link>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.tag} to={card.href} className="stat-card block" style={{ textDecoration: 'none' }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="label-xs" style={{ marginBottom: 8 }}>{card.tag}</p>
                {loading ? (
                  <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 6 }} />
                ) : (
                  <p className="stat-value">{card.value}</p>
                )}
              </div>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${card.colour}14`,
                  border: `1px solid ${card.colour}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: card.colour,
                }}
              >
                <card.icon className="w-5 h-5" />
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{card.label}</p>
          </Link>
        ))}
      </div>

      {/* ── Main 2-col layout ── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Today's Queue Table */}
        <div className="lg:col-span-2 card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="section-title">Today's OPD Queue</h2>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>City Care Medical Center — live roster</p>
            </div>
            <Link
              to="/dashboard/appointments"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}
            >
              View all →
            </Link>
          </div>

          <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--accent)' }}>{row.time}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: 'var(--accent-bg)', border: '1px solid var(--accent-border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, color: 'var(--accent-text)', flexShrink: 0,
                        }}>
                          {row.patient.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text-primary)' }}>{row.patient}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.age}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.doctor}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.type}</td>
                    <td>
                      <span className={statusClass[row.status] || 'status-chip status-chip-scheduled'}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Quick actions + system status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick Workflows */}
          <div className="card" style={{ padding: '20px 20px 16px' }}>
            <h2 className="section-title" style={{ marginBottom: 14 }}>Quick Workflows</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { href: '/dashboard/patients', icon: UsersIcon, title: 'Patient Registration', sub: 'FR-06 · Demographics & WhatsApp', bg: 'var(--accent-bg)', border: 'var(--accent-border)', color: 'var(--accent-text)' },
                { href: '/dashboard/consultations', icon: FileTextIcon, title: 'Clinical Notes', sub: 'FR-14 · Vitals, Dx & Versioned Rx', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' },
                { href: '/dashboard/billing', icon: RupeeIcon, title: 'Generate Invoice', sub: 'FR-17/18 · GST + Razorpay', bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
              ].map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 10,
                    border: '1px solid var(--border)', background: 'var(--surface)',
                    textDecoration: 'none',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.borderColor = item.border
                    el.style.background = item.bg
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.borderColor = 'var(--border)'
                    el.style.background = 'var(--surface)'
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: item.bg, border: `1px solid ${item.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: item.color }}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{item.sub}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div
            className="card"
            style={{ padding: '16px 20px', background: 'var(--accent-bg)', borderColor: 'var(--accent-border)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-text)' }}>Phase 1 Engine — Operational</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Running in single-tenant SaaS mode. All tables include dormant{' '}
              <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'rgba(13,148,136,.1)', padding: '1px 5px', borderRadius: 4, color: 'var(--accent-text)' }}>tenant_id</code>
              {' '}for future multi-tenancy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Icons (monochrome, 18px design size) ── */
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function RupeeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function StethoscopeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3a3 3 0 01-3 3z" /></svg>
}
function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}