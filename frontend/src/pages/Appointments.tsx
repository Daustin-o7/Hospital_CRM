import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert, friendlyError } from '../components/ui/Alert'
import { AppointmentBadge } from '../components/ui/Badge'
import { EmptyAppointments } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Schema ────────────────────────────────────────────────────────────────────
const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  doctorId:  z.string().min(1, 'Select a doctor'),
  date:      z.string().min(1, 'Date is required'),
  time:      z.string().min(1, 'Time is required'),
  type:      z.enum(['scheduled', 'walkin']),
})
type AppointmentForm = z.infer<typeof appointmentSchema>

interface Appointment {
  appointmentId: string
  patientName: string
  doctorName: string
  time: string
  status: string
  queueToken: number | null
  type: string
}
interface Doctor  { id: string; name: string }
interface Patient { id: string; name: string; phone: string }

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date(); today.setHours(0,0,0,0)
  const diff = Math.round((new Date(dateStr).setHours(0,0,0,0) - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors]   = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { type: 'scheduled', date: new Date().toISOString().split('T')[0] },
  })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/appointments?date=${selectedDate}`)
      setAppointments(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchMeta = useCallback(async () => {
    const [docRes, patRes] = await Promise.allSettled([
      api.get('/users?role=doctor'),
      api.get('/patients/search?q='),
    ])
    if (docRes.status === 'fulfilled' && Array.isArray(docRes.value.data)) setDoctors(docRes.value.data)
    if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) setPatients(patRes.value.data)
  }, [])

  const handleCheckIn = async (aptId: string) => {
    try {
      const res = await api.post(`/appointments/${aptId}/check-in`)
      const token = res.data?.queueToken ?? null
      setAppointments(prev => prev.map(a =>
        a.appointmentId === aptId ? { ...a, status: 'checked_in', queueToken: token } : a
      ))
    } catch {}
  }

  const onSubmit = useCallback(async (data: AppointmentForm) => {
    setSubmitError('')
    const p = patients.find(pt => pt.id === data.patientId)
    const d = doctors.find(dc => dc.id === data.doctorId)
    try {
      const res = await api.post('/appointments', { ...data, timeSlot: data.time })
      setAppointments(prev => [
        res.data ?? {
          appointmentId: `apt-${Date.now()}`,
          patientName: p?.name ?? 'Patient',
          doctorName:  d?.name ?? 'Doctor',
          time: data.time, status: 'booked', queueToken: null, type: data.type,
        },
        ...prev,
      ])
      reset()
      setShowModal(false)
    } catch (err: any) {
      setSubmitError(friendlyError(err))
    }
  }, [patients, doctors, reset])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { fetchMeta() }, [fetchMeta])

  const stats = {
    total:     appointments.length,
    completed: appointments.filter(a => a.status === 'completed').length,
    waiting:   appointments.filter(a => ['booked', 'scheduled', 'checked_in'].includes(a.status)).length,
  }

  const [selectedDocFilter, setSelectedDocFilter] = useState<string>('all')

  const filteredAppointments = appointments.filter(a => {
    if (selectedDocFilter !== 'all' && a.doctorName !== selectedDocFilter) return false
    return true
  })

  const setRelativeDate = (daysAhead: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysAhead)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  return (
    <div className="animate-fadein space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Appointments
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/70">
              Live Queue Active
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Schedule slots, assign OPD queue tokens, and track real-time doctor availability.
          </p>
        </div>
        <button
          id="book-appointment-btn"
          className="btn btn-primary"
          onClick={() => { setSubmitError(''); setShowModal(true) }}
          style={{ padding: '9px 18px', fontSize: '13px' }}
        >
          <PlusIcon />
          <span>Book New Appointment</span>
        </button>
      </div>

      {/* ── Date Selector & Queue Stats Strip ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Date picker + Quick date pills (7 cols) */}
        <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="appt-date" className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
              Date:
            </label>
            <input
              id="appt-date"
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{ width: 150, padding: '6px 10px', fontSize: '13px' }}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setRelativeDate(0)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                formatRelativeDate(selectedDate) === 'Today'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setRelativeDate(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                formatRelativeDate(selectedDate) === 'Tomorrow'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700'
              }`}
            >
              Tomorrow
            </button>
            <span className="text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2.5 py-1 rounded-full ml-1">
              {formatRelativeDate(selectedDate)}
            </span>
          </div>

          {doctors.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 w-full mt-1">
              <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider mr-1">Doctor:</span>
              <button
                type="button"
                onClick={() => setSelectedDocFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedDocFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
              {doctors.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDocFilter(d.name)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors ${
                    selectedDocFilter === d.name ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {d.name.replace('Dr. ', '')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Live OPD Stats Mini-Cards (5 cols) */}
        <div className="lg:col-span-5 grid grid-cols-3 gap-2.5">
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs text-center">
            <div className="text-lg font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? '—' : stats.total}
            </div>
            <div className="text-[10.5px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Total Slots</div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-xs text-center">
            <div className="text-lg font-bold text-amber-700" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? '—' : stats.waiting}
            </div>
            <div className="text-[10.5px] text-amber-700 font-semibold uppercase tracking-wider mt-0.5">Waiting Queue</div>
          </div>
          <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 shadow-xs text-center">
            <div className="text-lg font-bold text-emerald-700" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? '—' : stats.completed}
            </div>
            <div className="text-[10.5px] text-emerald-700 font-semibold uppercase tracking-wider mt-0.5">Completed</div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Queue Token</th><th>Slot Time</th><th>Patient Information</th><th>Consulting Doctor</th><th>Type</th><th>Status</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody>
          </table>
        ) : filteredAppointments.length === 0 ? (
          <EmptyAppointments onBook={() => setShowModal(true)} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Appointments">
              <thead>
                <tr>
                  <th>Queue Token</th>
                  <th>Slot Time</th>
                  <th>Patient Details</th>
                  <th>Consulting Doctor</th>
                  <th>Visit Type</th>
                  <th>Queue Status</th>
                  <th aria-label="Actions" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAppointments.map(appt => (
                  <tr key={appt.appointmentId} className="hover:bg-slate-50/70 transition-colors">
                    <td>
                      {appt.queueToken ? (
                        <span
                          className="inline-flex items-center justify-center font-bold px-2.5 py-1 rounded-xl text-xs"
                          style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            color: '#38bdf8',
                            fontFamily: 'var(--font-mono)',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.15)',
                            letterSpacing: '0.04em'
                          }}
                        >
                          #{String(appt.queueToken).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        {appt.time}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                          {appt.patientName.slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13.5px' }}>
                          {appt.patientName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-800">{appt.doctorName}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          appt.type === 'walkin'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}
                      >
                        {appt.type === 'walkin' ? 'Walk-in' : 'Scheduled'}
                      </span>
                    </td>
                    <td><AppointmentBadge status={appt.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {['booked', 'scheduled'].includes(appt.status.toLowerCase()) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCheckIn(appt.appointmentId)}
                          aria-label={`Check in ${appt.patientName}`}
                          style={{ fontSize: '11.5px', padding: '4px 12px', fontWeight: 600 }}
                        >
                          ✓ Check In
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Book Appointment Modal ── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset(); setSubmitError('') }}
        title="Book appointment"
        description="Select patient profile, assign doctor, and lock slot time."
      >
        {submitError && (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" onDismiss={() => setSubmitError('')}>{submitError}</Alert>
          </div>
        )}

        <form id="book-appt-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Patient */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="appt-patient" className="form-label">Patient *</label>
              <select id="appt-patient" className="form-select" {...register('patientId')}>
                <option value="">Select patient…</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}
              </select>
              {errors.patientId && <p className="form-error">{errors.patientId.message}</p>}
            </div>

            {/* Doctor */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="appt-doctor" className="form-label">Doctor *</label>
              <select id="appt-doctor" className="form-select" {...register('doctorId')}>
                <option value="">Select doctor…</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {errors.doctorId && <p className="form-error">{errors.doctorId.message}</p>}
            </div>

            {/* Date */}
            <div>
              <label htmlFor="appt-date-input" className="form-label">Date *</label>
              <input id="appt-date-input" type="date" className="form-input" {...register('date')} />
              {errors.date && <p className="form-error">{errors.date.message}</p>}
            </div>

            {/* Time */}
            <div>
              <label htmlFor="appt-time" className="form-label">Time slot *</label>
              <input id="appt-time" type="time" className="form-input" {...register('time')} />
              {errors.time && <p className="form-error">{errors.time.message}</p>}
            </div>

            {/* Type */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Appointment type</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['scheduled', 'walkin'] as const).map(t => (
                  <label
                    key={t}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <input type="radio" {...register('type')} value={t} style={{ accentColor: 'var(--brand-primary)' }} />
                    {t === 'scheduled' ? 'Scheduled' : 'Walk-in'}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowModal(false); reset() }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              id="submit-appt-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Booking…' : 'Book appointment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}