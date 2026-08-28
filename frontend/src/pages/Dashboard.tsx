import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

interface Stats {
  patients: number
  appointmentsToday: number
  revenueToday: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ patients: 0, appointmentsToday: 0, revenueToday: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const [patientsRes, appointmentsRes, invoicesRes] = await Promise.all([
          axios.get('/api/v1/patients/search?q=test', { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/v1/appointments?date=' + new Date().toISOString().split('T')[0], { headers: { Authorization: `Bearer ${token}` } }),
          axios.get('/api/v1/invoices?status=paid', { headers: { Authorization: `Bearer ${token}` } })
        ])
        setStats({
          patients: patientsRes.data.length,
          appointmentsToday: appointmentsRes.data.length,
          revenueToday: invoicesRes.data.reduce((sum: number, inv: any) => sum + inv.total, 0)
        })
      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Total Patients', value: stats.patients, icon: UsersIcon, color: 'primary', href: '/dashboard/patients' },
    { label: "Today's Appointments", value: stats.appointmentsToday, icon: CalendarIcon, color: 'emerald', href: '/dashboard/appointments' },
    { label: "Today's Revenue", value: `₹${stats.revenueToday.toLocaleString()}`, icon: RupeeIcon, color: 'amber', href: '/dashboard/billing' },
  ]

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Welcome back. Here's what's happening today.</p>
      </div>

      <div className="grid-auto-fit mb-8">
        {statCards.map((card) => (
          <Link key={card.label} to={card.href} className="card-glass glass-card-hover group">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-600 group-hover:text-slate-700">{card.label}</p>
                <p className="text-3xl font-bold text-slate-900 mt-1 group-hover:text-primary-700 transition-colors">
                  {loading ? '—' : card.value}
                </p>
              </div>
              <div className={`p-3 rounded-xl bg-${card.color}-100 text-${card.color}-600 group-hover:bg-${card.color}-200 transition-colors`}>
                <card.icon className="w-6 h-6" aria-hidden="true" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-glass">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link to="/dashboard/patients" className="btn-secondary w-full justify-start gap-3 p-4 hover:bg-primary-50 hover:border-primary-200 transition-colors">
              <UsersIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
              <span>Register Patient</span>
            </Link>
            <Link to="/dashboard/appointments" className="btn-secondary w-full justify-start gap-3 p-4 hover:bg-emerald-50 hover:border-emerald-200 transition-colors">
              <CalendarIcon className="w-5 h-5 text-emerald-600" aria-hidden="true" />
              <span>Book Appointment</span>
            </Link>
            <Link to="/dashboard/billing" className="btn-secondary w-full justify-start gap-3 p-4 hover:bg-amber-50 hover:border-amber-200 transition-colors">
              <PlusIcon className="w-5 h-5 text-amber-600" aria-hidden="true" />
              <span>Create Invoice</span>
            </Link>
            <Link to="/dashboard/consultations" className="btn-secondary w-full justify-start gap-3 p-4 hover:bg-violet-50 hover:border-violet-200 transition-colors">
              <FileTextIcon className="w-5 h-5 text-violet-600" aria-hidden="true" />
              <span>New Consultation</span>
            </Link>
          </div>
        </div>

        <div className="card-glass">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <Link to="/dashboard/patients" className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all</Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-slate-200 rounded" />
                    <div className="h-3 w-1/2 bg-slate-200 rounded" />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-center py-8">No recent activity</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function RupeeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}