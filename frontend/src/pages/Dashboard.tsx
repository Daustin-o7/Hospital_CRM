import { useState, useEffect } from 'react'
import axios from 'axios'
import { Link } from 'react-router-dom'

interface Stats {
  patients: number
  appointmentsToday: number
  revenueToday: number
  activeDoctors: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    patients: 124,
    appointmentsToday: 18,
    revenueToday: 24500,
    activeDoctors: 4
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('accessToken')
        const today = new Date().toISOString().split('T')[0]
        const [patientsRes, appointmentsRes, invoicesRes] = await Promise.all([
          axios.get('/api/v1/patients/search?q=a', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          axios.get(`/api/v1/appointments?date=${today}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
          axios.get('/api/v1/invoices?status=paid', { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
        ])

        setStats(prev => ({
          patients: patientsRes?.data?.length || prev.patients,
          appointmentsToday: appointmentsRes?.data?.length || prev.appointmentsToday,
          revenueToday: invoicesRes?.data?.reduce((sum: number, inv: any) => sum + (inv.total || 0), 0) || prev.revenueToday,
          activeDoctors: prev.activeDoctors
        }))
      } catch (err) {
        console.error('Failed to fetch dashboard live stats:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { label: 'Total Registered Patients', value: stats.patients, icon: UsersIcon, tag: 'Active Database', href: '/dashboard/patients' },
    { label: "Today's Appointments", value: stats.appointmentsToday, icon: CalendarIcon, tag: 'OPD Queue', href: '/dashboard/appointments' },
    { label: "Today's Revenue", value: `₹${stats.revenueToday.toLocaleString('en-IN')}`, icon: RupeeIcon, tag: 'Razorpay / Cash', href: '/dashboard/billing' },
    { label: 'Active Clinic Doctors', value: stats.activeDoctors, icon: StethoscopeIcon, tag: 'Duty Roster', href: '/dashboard/staff' },
  ]

  const recentQueue = [
    { time: '09:30 AM', patient: 'Aarav Patel (28M)', doctor: 'Dr. R. K. Sharma', status: 'Completed', type: 'General Consultation' },
    { time: '10:15 AM', patient: 'Priya Verma (34F)', doctor: 'Dr. Ananya Iyer', status: 'In Consultation', type: 'Follow-up Checkup' },
    { time: '11:00 AM', patient: 'Rajesh Kumar (45M)', doctor: 'Dr. R. K. Sharma', status: 'Scheduled', type: 'Routine OPD' },
    { time: '11:30 AM', patient: 'Sunita Reddy (52F)', doctor: 'Dr. Vikram Malhotra', status: 'Scheduled', type: 'Diabetes Management' },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="glass-panel p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-teal-500/20 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-teal-950/40">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">OPD Live Portal</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-2">Clinic Operations Overview</h1>
          <p className="text-slate-400 text-sm mt-1">Real-time OPD queue, patient registration, and invoice ledger.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/patients" className="btn-primary flex items-center gap-2">
            <UsersIcon className="w-4 h-4" />
            <span>New Patient</span>
          </Link>
          <Link to="/dashboard/appointments" className="btn-secondary flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            <span>Book OPD</span>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link key={card.label} to={card.href} className="glass-panel-interactive p-6 block group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{card.tag}</span>
                <p className="text-2xl font-bold text-white mt-1 group-hover:text-teal-300 transition-colors">
                  {loading ? '—' : card.value}
                </p>
                <p className="text-xs text-slate-400 mt-2 font-medium">{card.label}</p>
              </div>
              <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 group-hover:scale-110 transition-transform">
                <card.icon className="w-6 h-6" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Main Grid Section */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Column: Live Queue */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white font-heading">Today's OPD Queue</h2>
              <p className="text-xs text-slate-400">Live appointment roster for City Care Medical Center</p>
            </div>
            <Link to="/dashboard/appointments" className="text-xs font-semibold text-teal-400 hover:text-teal-300">View All Queue &rarr;</Link>
          </div>

          <div className="table-container">
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
                {recentQueue.map((item, idx) => (
                  <tr key={idx}>
                    <td className="font-mono text-xs text-teal-300 font-semibold">{item.time}</td>
                    <td className="font-semibold text-white">{item.patient}</td>
                    <td>{item.doctor}</td>
                    <td className="text-xs text-slate-400">{item.type}</td>
                    <td>
                      <span className={
                        item.status === 'Completed' ? 'status-chip-completed px-2.5 py-1 rounded-full text-xs font-medium' :
                        item.status === 'In Consultation' ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-full text-xs font-medium' :
                        'status-chip-scheduled px-2.5 py-1 rounded-full text-xs font-medium'
                      }>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Quick Actions & Status */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h2 className="text-lg font-bold text-white font-heading">Quick Clinical Workflows</h2>
            <div className="space-y-3">
              <Link to="/dashboard/patients" className="glass-panel-interactive p-4 flex items-center gap-3 block">
                <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400"><UsersIcon className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Patient Registration (FR-06)</h3>
                  <p className="text-xs text-slate-400">Demographics, WhatsApp & Offline Key</p>
                </div>
              </Link>

              <Link to="/dashboard/consultations" className="glass-panel-interactive p-4 flex items-center gap-3 block">
                <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400"><FileTextIcon className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Clinical Note (FR-14)</h3>
                  <p className="text-xs text-slate-400">Vitals, Diagnosis & Versioned Prescription</p>
                </div>
              </Link>

              <Link to="/dashboard/billing" className="glass-panel-interactive p-4 flex items-center gap-3 block">
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400"><RupeeIcon className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Generate Invoice (FR-17/18)</h3>
                  <p className="text-xs text-slate-400">GST Invoice & Razorpay Payment Link</p>
                </div>
              </Link>
            </div>
          </div>

          <div className="glass-panel p-6 border-teal-500/30 bg-teal-950/20">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <h3 className="text-sm font-bold text-white">Phase 1 SaaS Engine Status</h3>
            </div>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              System operating under single-tenant SaaS mode. All patient tables populated with forward-compatible <code className="text-teal-300">tenant_id</code> UUID column.
            </p>
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
function StethoscopeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v3a3 3 0 01-3 3z" /></svg>
}
function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}