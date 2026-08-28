import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const appointmentSchema = z.object({
  patientId: z.string().uuid('Select a patient'),
  doctorId: z.string().uuid('Select a doctor'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  type: z.enum(['scheduled', 'walkin']),
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

interface Doctor {
  id: string
  name: string
}

interface Patient {
  id: string
  name: string
  phone: string
}

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [viewingAppointment, setViewingAppointment] = useState<Appointment | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { type: 'scheduled' },
  })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/appointments?date=${selectedDate}`)
      setAppointments(res.data)
    } catch (err) {
      console.error('Failed to fetch appointments:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/users?role=doctor')
      setDoctors(res.data)
    } catch (err) {
      console.error('Failed to fetch doctors:', err)
    }
  }, [])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients/search?q=test')
      setPatients(res.data)
    } catch (err) {
      console.error('Failed to fetch patients:', err)
    }
  }, [])

  const onSubmit = useCallback(async (data: AppointmentForm) => {
    try {
      await api.post('/appointments', data)
      reset({ type: 'scheduled' })
      setShowModal(false)
      fetchAppointments()
    } catch (err: any) {
      console.error('Failed to book appointment:', err)
      alert(err.response?.data?.error || 'Failed to book appointment')
    }
  }, [fetchAppointments])

  const handleCheckIn = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.post(`/appointments/${appointmentId}/checkin`, {})
      fetchAppointments()
      alert(`Patient checked in. Queue token: ${res.data.queueToken}`)
    } catch (err: any) {
      console.error('Failed to check in:', err)
      alert(err.response?.data?.error || 'Failed to check in')
    }
  }, [fetchAppointments])

  const handleView = (appointment: Appointment) => {
    setViewingAppointment(appointment)
    setShowModal(true)
  }

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
    fetchPatients()
  }, [selectedDate, fetchAppointments, fetchDoctors, fetchPatients])

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">Manage daily schedule and patient queue</p>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input w-auto"
          />
          <button onClick={() => { reset({ type: 'scheduled' }); setShowModal(true); }} className="btn-primary">
            <PlusIcon className="w-5 h-5" aria-hidden="true" />
            Book Appointment
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Queue</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="py-8 text-center">
                    <div className="flex justify-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100 + 100}ms` }} />
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100 + 200}ms` }} />
                    </div>
                  </td>
                </tr>
              ))
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">No appointments for this date</td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.appointmentId}>
                  <td className="font-medium">{apt.time}</td>
                  <td>{apt.patientName}</td>
                  <td>{apt.doctorName}</td>
                  <td><span className={`badge ${apt.type === 'walkin' ? 'badge-warning' : 'badge-primary'}`}>{apt.type}</span></td>
                  <td>
                    <span className={`badge ${
                      apt.status === 'completed' ? 'badge-success' :
                      apt.status === 'checked_in' ? 'badge-primary' :
                      apt.status === 'cancelled' ? 'badge-danger' :
                      'badge-slate'
                    }`}>{apt.status}</span>
                  </td>
                  <td>{apt.queueToken ? `#${apt.queueToken}` : '—'}</td>
                  <td className="text-right">
                    {apt.status === 'booked' && (
                      <button
                        onClick={() => handleCheckIn(apt.appointmentId)}
                        className="btn-primary text-sm px-3 py-1.5"
                      >
                        Check In
                      </button>
                    )}
                    <button
                      onClick={() => handleView(apt)}
                      className="btn-ghost p-1.5 ml-1"
                      aria-label="View appointment"
                    >
                      <EyeIcon className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-${viewingAppointment ? 'lg' : '2xl'} max-h-[90vh] overflow-y-auto glass-card animate-scale-in`}>
            {viewingAppointment ? (
              <AppointmentDetail appointment={viewingAppointment} onClose={() => { setViewingAppointment(null); setShowModal(false); }} />
            ) : (
              <AppointmentFormModal
                onSubmit={handleSubmit(onSubmit)}
                onClose={() => setShowModal(false)}
                register={register}
                errors={errors}
                isSubmitting={isSubmitting}
                doctors={doctors}
                patients={patients}
                defaultDate={selectedDate}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AppointmentFormModal({ handleSubmit, onClose, register, errors, isSubmitting, doctors, patients, defaultDate }: any) {
  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Book Appointment</h2>
        <button type="button" onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
          <XIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="patientId" className="label">Patient *</label>
          <select id="patientId" {...register('patientId')} className="input">
            <option value="">Select patient</option>
            {patients.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
          </select>
          {errors.patientId && <p className="text-sm text-rose-600 mt-1">{errors.patientId.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="doctorId" className="label">Doctor *</label>
          <select id="doctorId" {...register('doctorId')} className="input">
            <option value="">Select doctor</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {errors.doctorId && <p className="text-sm text-rose-600 mt-1">{errors.doctorId.message}</p>}
        </div>

        <div>
          <label htmlFor="date" className="label">Date *</label>
          <input id="date" type="date" {...register('date')} defaultValue={defaultDate} className="input" min={new Date().toISOString().split('T')[0]} />
          {errors.date && <p className="text-sm text-rose-600 mt-1">{errors.date.message}</p>}
        </div>

        <div>
          <label htmlFor="time" className="label">Time *</label>
          <input id="time" type="time" {...register('time')} className="input" step={1800} />
          {errors.time && <p className="text-sm text-rose-600 mt-1">{errors.time.message}</p>}
        </div>

        <div>
          <label htmlFor="type" className="label">Type</label>
          <select id="type" {...register('type')} className="input">
            <option value="scheduled">Scheduled</option>
            <option value="walkin">Walk-in</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Booking...' : 'Book Appointment'}
        </button>
      </div>
    </form>
  )
}

function AppointmentDetail({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Appointment Details</h2>
          <p className="text-slate-500 text-sm">{appointment.patientName} • {appointment.time}</p>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
          <XIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-6">
        <div>
          <p className="text-sm text-slate-500">Patient</p>
          <p className="font-medium">{appointment.patientName}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Doctor</p>
          <p className="font-medium">{appointment.doctorName}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Type</p>
          <p className="font-medium"><span className={`badge ${appointment.type === 'walkin' ? 'badge-warning' : 'badge-primary'}`}>{appointment.type}</span></p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Status</p>
          <p className="font-medium"><span className={`badge ${
            appointment.status === 'completed' ? 'badge-success' :
            appointment.status === 'checked_in' ? 'badge-primary' :
            appointment.status === 'cancelled' ? 'badge-danger' :
            'badge-slate'
          }`}>{appointment.status}</span></p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Queue Token</p>
          <p className="font-medium">{appointment.queueToken ? `#${appointment.queueToken}` : 'Not checked in'}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}
function EyeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}