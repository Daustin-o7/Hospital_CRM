import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { AppointmentBadge } from '../components/ui/Badge'
import { EmptyAppointments } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'
import { Skeleton } from '../components/ui/EmptyState'

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
    if (docRes.status === 'fulfilled' && Array.isArray(docRes.value.data)) {
      setDoctors(docRes.value.data)
    }
    if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) {
      setPatients(patRes.value.data)
    }
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
        res.data?.appointmentId ? res.data : {
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
      setAppointments(prev => [
        {
          appointmentId: `apt-${Date.now()}`,
          patientName: p?.name ?? 'Patient',
          doctorName:  d?.name ?? 'Doctor',
          time: data.time, status: 'booked', queueToken: null, type: data.type,
        },
        ...prev,
      ])
      reset()
      setShowModal(false)
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
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Appointments
            </h1>
            <span className="badge badge-info">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse-soft"></span>
              Live Queue Active
            </span>
          </div>
          <p className="text-xs font-medium mt-1 text-[var(--color-text-muted)]">
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
        <div className="card lg:col-span-7 p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="appt-date" className="text-xs font-bold uppercase tracking-wider whitespace-nowrap text-[var(--color-text-muted)]">
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
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                formatRelativeDate(selectedDate) === 'Today'
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Today
            </button>
            <button
              type="button"
              onClick={() => setRelativeDate(1)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                formatRelativeDate(selectedDate) === 'Tomorrow'
                  ? 'btn-primary'
                  : 'btn-secondary'
              }`}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Tomorrow
            </button>
            <span className="badge badge-brand ml-1">
              {formatRelativeDate(selectedDate)}
            </span>
          </div>

          {doctors.length > 0 && (
            <div className="flex items-center gap-1.5 pt-2 border-t w-full mt-1" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <span className="text-[10.5px] font-bold uppercase tracking-wider mr-1 text-[var(--color-text-muted)]">Doctor:</span>
              <button
                type="button"
                onClick={() => setSelectedDocFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedDocFilter === 'all' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                All
              </button>
              {doctors.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setSelectedDocFilter(d.name)}
                  className={`px-2 py-0.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedDocFilter === d.name ? 'btn-primary' : 'btn-secondary'
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
          <div className="card p-3.5 text-center hover-card">
            <div className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900">
              <svg width="16" height="16" fill="none" stroke="#2563eb" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </div>
            <div className="text-xl font-bold text-[var(--color-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? <Skeleton width="36px" height="24px" style={{ margin: '0 auto' }} /> : stats.total}
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mt-0.5 text-[var(--color-text-muted)]">Total Slots</div>
          </div>
          <div className="card p-3.5 text-center hover-card" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning-border)' }}>
            <div className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800">
              <svg width="16" height="16" fill="none" stroke="#d97706" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="text-xl font-bold text-[var(--color-warning-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? <Skeleton width="36px" height="24px" style={{ margin: '0 auto' }} /> : stats.waiting}
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mt-0.5 text-[var(--color-warning-text)]">Waiting Queue</div>
          </div>
          <div className="card p-3.5 text-center hover-card" style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success-border)' }}>
            <div className="w-8 h-8 rounded-xl mx-auto mb-2 flex items-center justify-center bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800">
              <svg width="16" height="16" fill="none" stroke="#059669" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div className="text-xl font-bold text-[var(--color-success-text)]" style={{ fontFamily: 'var(--font-heading)' }}>
              {loading ? <Skeleton width="36px" height="24px" style={{ margin: '0 auto' }} /> : stats.completed}
            </div>
            <div className="text-[10.5px] font-semibold uppercase tracking-wider mt-0.5 text-[var(--color-success-text)]">Completed</div>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4 text-xs text-[var(--color-text-muted)]">
              <span className="spinner spinner-sm" />
              <span>Loading appointments for {formatRelativeDate(selectedDate)}…</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Queue Token</th><th>Slot Time</th><th>Patient Information</th><th>Consulting Doctor</th><th>Type</th><th>Status</th><th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody>
            </table>
          </div>
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
                  <tr key={appt.appointmentId} className="transition-colors hover:bg-[var(--color-surface-hover)]">
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
                        <span className="text-xs font-medium text-[var(--color-text-muted)]">—</span>
                      )}
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: '13px' }}>
                        {appt.time}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                          {appt.patientName.slice(0, 1).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13.5px' }}>
                          {appt.patientName}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <svg width="12" height="12" fill="none" stroke="var(--color-text-muted)" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        <span className="text-xs font-semibold text-[var(--color-text)]">{appt.doctorName}</span>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          appt.type === 'walkin'
                            ? 'badge badge-warning'
                            : 'badge badge-info'
                        }`}
                      >
                        {appt.type === 'walkin' ? '🚶 Walk-in' : '📅 Scheduled'}
                      </span>
                    </td>
                    <td><AppointmentBadge status={appt.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {['booked', 'scheduled'].includes(appt.status.toLowerCase()) && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleCheckIn(appt.appointmentId)}
                          aria-label={`Check in ${appt.patientName}`}
                          style={{ fontSize: '11.5px', padding: '5px 14px', fontWeight: 600 }}
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          Check In
                        </button>
                      )}
                      {appt.status === 'checked_in' && (
                        <span className="badge badge-warning text-[10.5px] animate-pulse-soft">In Queue</span>
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
        title="Book New Appointment"
        description="Select patient profile, assign doctor, and lock a slot time."
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
                {([
                  { value: 'scheduled' as const, label: '📅 Scheduled', desc: 'Pre-booked slot' },
                  { value: 'walkin' as const, label: '🚶 Walk-in', desc: 'No prior booking' },
                ]).map(t => (
                  <label
                    key={t.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '10px 14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: 'var(--color-text-secondary)',
                      flex: 1,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input type="radio" {...register('type')} value={t.value} style={{ accentColor: 'var(--brand-primary)' }} />
                    <div>
                      <div className="font-semibold">{t.label}</div>
                      <div className="text-[10.5px] text-[var(--color-text-muted)]">{t.desc}</div>
                    </div>
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