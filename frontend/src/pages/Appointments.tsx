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
      const res = await api.get(`/v1/appointments?date=${selectedDate}`)
      setAppointments(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchMeta = useCallback(async () => {
    const [docRes, patRes] = await Promise.allSettled([
      api.get('/v1/users?role=doctor'),
      api.get('/v1/patients/search?q='),
    ])
    if (docRes.status === 'fulfilled' && Array.isArray(docRes.value.data)) setDoctors(docRes.value.data)
    if (patRes.status === 'fulfilled' && Array.isArray(patRes.value.data)) setPatients(patRes.value.data)
  }, [])

  const handleCheckIn = async (aptId: string) => {
    try {
      const res = await api.post(`/v1/appointments/${aptId}/check-in`)
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
      const res = await api.post('/v1/appointments', { ...data, timeSlot: data.time })
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

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-description">
            Schedule slots, check-in patients, and manage the OPD queue.
          </p>
        </div>
        <button
          id="book-appointment-btn"
          className="btn btn-primary"
          onClick={() => { setSubmitError(''); setShowModal(true) }}
        >
          <PlusIcon />
          Book appointment
        </button>
      </div>

      {/* ── Date selector + stats strip ── */}
      <div
        className="card"
        style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="appt-date" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            Viewing date
          </label>
          <input
            id="appt-date"
            type="date"
            className="form-input"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            style={{ width: 160 }}
          />
          <span
            style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--brand-primary)',
              background: 'var(--brand-primary-10)',
              border: '1px solid var(--brand-primary-20)',
              borderRadius: 'var(--radius-full)',
              padding: '2px 10px',
            }}
          >
            {formatRelativeDate(selectedDate)}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20, marginLeft: 'auto' }}>
          {[
            { label: 'Total', value: stats.total },
            { label: 'Completed', value: stats.completed },
            { label: 'Remaining', value: stats.waiting },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.04em' }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Type</th><th>Status</th><th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>{Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody>
          </table>
        ) : appointments.length === 0 ? (
          <EmptyAppointments onBook={() => setShowModal(true)} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Appointments">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {appointments.map(appt => (
                  <tr key={appt.appointmentId}>
                    <td>
                      {appt.queueToken
                        ? <span className="queue-token">{appt.queueToken}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      }
                    </td>
                    <td>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                        {appt.time}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{appt.patientName}</span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{appt.doctorName}</td>
                    <td>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
                        {appt.type === 'walkin' ? 'Walk-in' : 'Scheduled'}
                      </span>
                    </td>
                    <td><AppointmentBadge status={appt.status} /></td>
                    <td>
                      {['booked', 'scheduled'].includes(appt.status.toLowerCase()) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCheckIn(appt.appointmentId)}
                          aria-label={`Check in ${appt.patientName}`}
                          style={{ fontSize: 12, padding: '5px 12px' }}
                        >
                          Check in
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
        description="Schedule a new OPD slot for a patient."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); reset() }} disabled={isSubmitting}>
              Cancel
            </button>
            <button form="book-appt-form" type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Booking…' : 'Book appointment'}
            </button>
          </>
        }
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