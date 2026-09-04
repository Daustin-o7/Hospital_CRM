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
    { id: '1', time: '09:00', patientName: 'Ravi Kumar', doctorName: 'Dr. Mehta', type: 'Consultation', status: 'check-in' },
    { id: '2', time: '09:30', patientName: 'Priya Singh', doctorName: 'Dr. Mehta', type: 'Follow-up', status: 'waiting' },
    { id: '3', time: '10:00', patientName: 'Anil Verma', doctorName: 'Dr. Mehta', type: 'Consultation', status: 'upcoming' },
    { id: '4', time: '10:30', patientName: 'Neha Gupta', doctorName: 'Dr. Mehta', type: 'Consultation', status: 'upcoming' },
    { id: '5', time: '11:00', patientName: 'Mohan Lal', doctorName: 'Dr. Mehta', type: 'Consultation', status: 'upcoming' },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{greeting}, {displayName}</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Here's what's happening in your clinic today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Today's View</span>
          </div>
        </div>
      </div>

      {/* ── 4 Top KPI Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Appointments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appointments</span>
            <span className="text-slate-400 group-hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/appointments')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.appointmentsToday}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              12% vs yesterday
            </span>
          </div>
        </div>

        {/* Card 2: Patients */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Patients</span>
            <span className="text-slate-400 group-hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/patients')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.totalPatients}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              8% vs yesterday
            </span>
          </div>
        </div>

        {/* Card 3: Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</span>
            <span className="text-slate-400 group-hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/billing')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              ₹{stats.revenueToday.toLocaleString('en-IN')}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              15% vs yesterday
            </span>
          </div>
        </div>

        {/* Card 4: Pending Payments */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Payments</span>
            <span className="text-slate-400 group-hover:text-slate-600 transition-colors cursor-pointer" onClick={() => navigate('/dashboard/billing')}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {stats.pendingPayments}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
              <svg className="w-3 h-3 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              3 vs yesterday
            </span>
          </div>
        </div>
      </div>

      {/* ── Main 3-Section Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Today's Schedule (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Today's Schedule</h2>
              <Link to="/dashboard/appointments" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                View all
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {schedule.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-3 group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-slate-400 font-mono w-11 flex-shrink-0">
                      {item.time}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">
                        {item.patientName}
                      </h4>
                      <p className="text-xs text-slate-400 truncate">
                        {item.type} • {item.doctorName}
                      </p>
                    </div>
                  </div>

                  <div>
                    {item.status === 'check-in' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Check-in
                      </span>
                    )}
                    {item.status === 'waiting' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Waiting
                      </span>
                    )}
                    {item.status === 'upcoming' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                        Upcoming
                      </span>
                    )}
                    {item.status === 'completed' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
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
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              + Add new schedule slot
            </button>
          </div>
        </div>

        {/* Middle Column: Queue Status (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Queue Status</h2>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            {/* Top 3 Counters */}
            <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
              <div>
                <div className="text-xl font-extrabold text-slate-900">7</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">Waiting</div>
              </div>
              <div className="border-x border-slate-200">
                <div className="text-xl font-extrabold text-emerald-600">2</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">In Consult</div>
              </div>
              <div>
                <div className="text-xl font-extrabold text-slate-700">1</div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">Completed</div>
              </div>
            </div>

            {/* Wait Times */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="p-3 rounded-xl border border-slate-100 bg-white">
                <div className="text-[11px] font-medium text-slate-400">Average Wait</div>
                <div className="text-lg font-bold text-slate-800 mt-0.5">18 min</div>
              </div>
              <div className="p-3 rounded-xl border border-slate-100 bg-white">
                <div className="text-[11px] font-medium text-slate-400">Longest Wait</div>
                <div className="text-lg font-bold text-rose-600 mt-0.5">34 min</div>
              </div>
            </div>

            {/* Hourly Wait Load Chart (Sparkline) */}
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">
                <span>9 AM</span>
                <span>10 AM</span>
                <span>11 AM</span>
                <span>12 PM</span>
              </div>
              <div className="h-16 w-full">
                <svg className="w-full h-full" viewBox="0 0 300 80" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="queueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0,60 Q 50,20 100,45 T 200,30 T 300,50 L 300,80 L 0,80 Z"
                    fill="url(#queueGradient)"
                  />
                  <path
                    d="M 0,60 Q 50,20 100,45 T 200,30 T 300,50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard/queue')}
            className="w-full mt-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors border border-emerald-200/60 text-center"
          >
            Manage Live Queue →
          </button>
        </div>

        {/* Right Column: Needs Attention (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Needs Attention</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                Action Required
              </span>
            </div>

            <div className="space-y-3">
              <div
                onClick={() => navigate('/dashboard/appointments')}
                className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 hover:bg-amber-100/60 transition-colors cursor-pointer flex items-start gap-3"
              >
                <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">3 appointments</span> awaiting confirmation
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/billing')}
                className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/60 hover:bg-rose-100/60 transition-colors cursor-pointer flex items-start gap-3"
              >
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">2 payments</span> are overdue
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/queue')}
                className="p-3 rounded-xl bg-blue-50/70 border border-blue-200/60 hover:bg-blue-100/60 transition-colors cursor-pointer flex items-start gap-3"
              >
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">1 patient</span> in emergency queue
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/consultations')}
                className="p-3 rounded-xl bg-purple-50/70 border border-purple-200/60 hover:bg-purple-100/60 transition-colors cursor-pointer flex items-start gap-3"
              >
                <div className="p-1.5 rounded-lg bg-purple-100 text-purple-700 flex-shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-900">5 lab reports</span> pending review
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => navigate('/dashboard/appointments')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:border-emerald-500/50 hover:bg-emerald-50/40 text-slate-700 hover:text-emerald-800 text-xs font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Appointment</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/patients')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:border-blue-500/50 hover:bg-blue-50/40 text-slate-700 hover:text-blue-800 text-xs font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Add Patient</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/billing')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:border-amber-500/50 hover:bg-amber-50/40 text-slate-700 hover:text-amber-800 text-xs font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Create Invoice</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/consultations')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:border-teal-500/50 hover:bg-teal-50/40 text-slate-700 hover:text-teal-800 text-xs font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>New Consultation</span>
          </button>

          <button
            onClick={() => navigate('/dashboard/messages')}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:border-purple-500/50 hover:bg-purple-50/40 text-slate-700 hover:text-purple-800 text-xs font-semibold transition-all shadow-sm"
          >
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Send Message</span>
          </button>
        </div>
      </div>
    </div>
  )
}