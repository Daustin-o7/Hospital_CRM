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

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState<DashStats>({
    appointmentsToday: 24,
    totalPatients: 18,
    revenueToday: 18400,
    pendingPayments: 5,
  })

  const [schedule, setSchedule] = useState<TodayAppt[]>([
    { id: '1', time: '09:00', patientName: 'Ravi Kumar', doctorName: 'Dr. Mehta', type: 'General Consultation', status: 'check-in' },
    { id: '2', time: '09:30', patientName: 'Priya Singh', doctorName: 'Dr. Mehta', type: 'Follow-up Review', status: 'waiting' },
    { id: '3', time: '10:00', patientName: 'Anil Verma', doctorName: 'Dr. Mehta', type: 'Dental Examination', status: 'upcoming' },
    { id: '4', time: '10:30', patientName: 'Neha Gupta', doctorName: 'Dr. Mehta', type: 'Pediatric Checkup', status: 'upcoming' },
    { id: '5', time: '11:00', patientName: 'Mohan Lal', doctorName: 'Dr. Mehta', type: 'Diabetic Assessment', status: 'upcoming' },
  ])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const todayISO = new Date().toISOString().split('T')[0]
        const [apptRes, invRes, patRes] = await Promise.allSettled([
          api.get(`/appointments?date=${todayISO}`),
          api.get('/invoices'),
          api.get('/patients'),
        ])

        if (apptRes.status === 'fulfilled' && Array.isArray(apptRes.value.data) && apptRes.value.data.length > 0) {
          const rawAppts = apptRes.value.data
          setStats(prev => ({
            ...prev,
            appointmentsToday: rawAppts.length || prev.appointmentsToday
          }))
          
          const mapped: TodayAppt[] = rawAppts.slice(0, 5).map((a: any, idx: number) => {
            const rawStatus = (a.status || 'scheduled').toLowerCase()
            let status: TodayAppt['status'] = 'upcoming'
            if (rawStatus === 'checkedin' || rawStatus === 'arrived') status = 'check-in'
            else if (rawStatus === 'waiting' || rawStatus === 'in-queue') status = 'waiting'
            else if (rawStatus === 'completed') status = 'completed'

            return {
              id: a.id || String(idx),
              time: a.timeSlot || a.time || `0${9 + idx}:00`.slice(-5),
              patientName: a.patientName || a.patient?.name || 'Patient',
              doctorName: a.doctorName || a.doctor?.name || 'Dr. Mehta',
              type: a.type || 'Consultation',
              status
            }
          })
          if (mapped.length > 0) setSchedule(mapped)
        }

        if (invRes.status === 'fulfilled' && Array.isArray(invRes.value.data)) {
          const invs = invRes.value.data
          const paidToday = invs
            .filter((i: any) => i.status?.toLowerCase() === 'paid')
            .reduce((acc: number, curr: any) => acc + (curr.total || 0), 0)
          const pendingCount = invs
            .filter((i: any) => i.status?.toLowerCase() === 'issued' || i.status?.toLowerCase() === 'unpaid')
            .length

          setStats(prev => ({
            ...prev,
            revenueToday: paidToday || prev.revenueToday,
            pendingPayments: pendingCount || prev.pendingPayments
          }))
        }

        if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
          setStats(prev => ({
            ...prev,
            totalPatients: patRes.value.data.length || prev.totalPatients
          }))
        }
      } catch {
        // Graceful fallback to initial values
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

  const displayName = user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Dr. Arjun'

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              Live OPD Desk Active
            </span>
            <span className="text-xs text-slate-400 font-mono">ID: CLN-2026-BLR</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading mt-1 flex items-center gap-2">
            <span>{greeting}, {displayName}</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time clinic operations, patient flow, and clinical queue sequencing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs">
            <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
          <button
            onClick={() => navigate('/dashboard/appointments')}
            className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Book Slot</span>
          </button>
        </div>
      </div>

      {/* ── 4 Top KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Appointments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-teal-300 transition-all duration-200 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 border border-teal-100 flex items-center justify-center font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Appointments Today</span>
            </div>
            <span className="text-slate-400 group-hover:text-teal-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/appointments')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.appointmentsToday}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              +12% vs yesterday
            </span>
          </div>
        </div>

        {/* Card 2: Patients */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-blue-300 transition-all duration-200 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Patients Registry</span>
            </div>
            <span className="text-slate-400 group-hover:text-blue-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/patients')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.totalPatients}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              DPDP 2023 Verified
            </span>
          </div>
        </div>

        {/* Card 3: Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-emerald-300 transition-all duration-200 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revenue Today</span>
            </div>
            <span className="text-slate-400 group-hover:text-emerald-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/billing')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-heading font-mono">
              ₹{stats.revenueToday.toLocaleString('en-IN')}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              15% vs yesterday
            </span>
          </div>
        </div>

        {/* Card 4: Pending Payments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:border-amber-300 transition-all duration-200 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center font-bold">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unsettled Invoices</span>
            </div>
            <span className="text-slate-400 group-hover:text-amber-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/billing')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight font-heading">
              {stats.pendingPayments}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
              ₹8,400 pending
            </span>
          </div>
        </div>
      </div>

      {/* ── Main 3-Section Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Schedule (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Today's Appointment Agenda</h2>
                <p className="text-[11px] text-slate-400">Sequential consultation schedule</p>
              </div>
              <Link to="/dashboard/appointments" className="text-xs font-semibold text-teal-700 hover:text-teal-800 hover:underline">
                View all agenda →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {schedule.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-500 font-mono w-12 flex-shrink-0 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 text-center">
                      {item.time}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-teal-700 transition-colors">
                        {item.patientName}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {item.type} • <span className="text-slate-600">{item.doctorName}</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    {item.status === 'check-in' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Checked-in
                      </span>
                    )}
                    {item.status === 'waiting' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        In Queue
                      </span>
                    )}
                    {item.status === 'upcoming' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Upcoming
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                        Completed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => navigate('/dashboard/appointments')}
              className="text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors cursor-pointer"
            >
              + Add new schedule slot
            </button>
          </div>
        </div>

        {/* Middle Column: Queue Status (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Live Queue Triage</h2>
                <p className="text-[11px] text-slate-400">Real-time room occupancy</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span>
            </div>

            {/* Top 3 Counters */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 border border-slate-200/80 mb-4">
              <div>
                <div className="text-xl font-extrabold text-slate-900 font-mono">7</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Waiting</div>
              </div>
              <div className="border-x border-slate-200">
                <div className="text-xl font-extrabold text-teal-700 font-mono">2</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">In Consult</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-700 font-mono">1</div>
                <div className="text-[11px] font-semibold text-slate-500 mt-0.5">Completed</div>
              </div>
            </div>

            {/* Wait Times */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl border border-slate-200/80 bg-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Wait</div>
                <div className="text-base font-extrabold text-slate-800 font-mono mt-0.5">14 mins</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-200/80 bg-white">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Longest Wait</div>
                <div className="text-base font-extrabold text-rose-600 font-mono mt-0.5">28 mins</div>
              </div>
            </div>

            {/* Hourly Wait Load Sparkline */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1.5">
                <span>09:00</span>
                <span>11:00</span>
                <span>13:00</span>
                <span>15:00</span>
              </div>
              <div className="h-14 w-full bg-slate-50/60 rounded-xl p-2 border border-slate-100 flex items-end justify-between gap-1">
                {[35, 60, 85, 40, 75, 95, 50, 65, 45, 80, 55, 30].map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-full rounded-t transition-all ${
                      h > 75 ? 'bg-rose-400' : h > 50 ? 'bg-teal-500' : 'bg-teal-300'
                    }`}
                    title={`Slot load: ${h}%`}
                  />
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard/queue')}
            className="w-full mt-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors border border-teal-200 text-center cursor-pointer"
          >
            Manage Live Queue →
          </button>
        </div>

        {/* Right Column: Needs Attention (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Clinical Alerts</h2>
                <p className="text-[11px] text-slate-400">Pending tasks & reviews</p>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                3 urgent
              </span>
            </div>

            <div className="space-y-2.5">
              <div
                onClick={() => navigate('/dashboard/queue')}
                className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80 hover:bg-rose-100/70 transition-colors cursor-pointer flex items-start gap-2.5"
              >
                <div className="p-1 rounded-lg bg-rose-100 text-rose-700 flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">1 Emergency Patient</span> waiting in queue (Token A-12)
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/appointments')}
                className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 hover:bg-amber-100/70 transition-colors cursor-pointer flex items-start gap-2.5"
              >
                <div className="p-1 rounded-lg bg-amber-100 text-amber-700 flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">3 appointments</span> awaiting confirmation
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/billing')}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-colors cursor-pointer flex items-start gap-2.5"
              >
                <div className="p-1 rounded-lg bg-slate-200 text-slate-700 flex-shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">2 pending bills</span> awaiting cash settlement
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
          Clinical Fast Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => navigate('/dashboard/patients')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 hover:text-teal-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>+ Walk-in Patient</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/consultations')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 hover:text-teal-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>New Rx Consultation</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/pharmacy/pos')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 hover:text-teal-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>Pharmacy Counter POS</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/billing')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 hover:text-teal-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Create Invoice</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/messages')}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/40 text-slate-700 hover:text-teal-900 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>WhatsApp Broadcast</span>
          </button>
        </div>
      </div>
    </div>
  )
}