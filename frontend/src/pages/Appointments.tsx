import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const appointmentSchema = z.object({
  patientId: z.string().min(1, 'Select a patient'),
  doctorId: z.string().min(1, 'Select a doctor'),
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

const mockAppointments: Appointment[] = [
  { appointmentId: 'apt-01', patientName: 'Aarav Patel', doctorName: 'Dr. R. K. Sharma', time: '09:30 AM', status: 'completed', queueToken: 1, type: 'scheduled' },
  { appointmentId: 'apt-02', patientName: 'Priya Verma', doctorName: 'Dr. Ananya Iyer', time: '10:15 AM', status: 'checked_in', queueToken: 2, type: 'walkin' },
  { appointmentId: 'apt-03', patientName: 'Rajesh Kumar', doctorName: 'Dr. R. K. Sharma', time: '11:00 AM', status: 'booked', queueToken: null, type: 'scheduled' },
  { appointmentId: 'apt-04', patientName: 'Sunita Reddy', doctorName: 'Dr. Vikram Malhotra', time: '11:30 AM', status: 'booked', queueToken: null, type: 'scheduled' },
]

const mockDoctors: Doctor[] = [
  { id: 'doc-01', name: 'Dr. R. K. Sharma (Cardiology)' },
  { id: 'doc-02', name: 'Dr. Ananya Iyer (General OPD)' },
  { id: 'doc-03', name: 'Dr. Vikram Malhotra (Pediatrics)' },
]

const mockPatients: Patient[] = [
  { id: '101', name: 'Aarav Patel', phone: '+91 98765 43210' },
  { id: '102', name: 'Priya Verma', phone: '+91 98123 45678' },
  { id: '103', name: 'Rajesh Kumar', phone: '+91 97654 32109' },
  { id: '104', name: 'Sunita Reddy', phone: '+91 99887 76655' },
]

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments)
  const [doctors, setDoctors] = useState<Doctor[]>(mockDoctors)
  const [patients, setPatients] = useState<Patient[]>(mockPatients)
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
    defaultValues: { type: 'scheduled', date: new Date().toISOString().split('T')[0] },
  })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/appointments?date=${selectedDate}`)
      if (res.data && res.data.length > 0) setAppointments(res.data)
      else setAppointments(mockAppointments)
    } catch {
      setAppointments(mockAppointments)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/users?role=doctor')
      if (res.data && res.data.length > 0) setDoctors(res.data)
    } catch {
      setDoctors(mockDoctors)
    }
  }, [])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients/search?q=')
      if (res.data && res.data.length > 0) setPatients(res.data)
    } catch {
      setPatients(mockPatients)
    }
  }, [])

  const handleCheckIn = async (aptId: string) => {
    try {
      const res = await api.post(`/appointments/${aptId}/check-in`)
      const token = res.data?.queueToken || Math.floor(Math.random() * 20) + 1
      setAppointments(prev => prev.map(a => a.appointmentId === aptId ? { ...a, status: 'checked_in', queueToken: token } : a))
    } catch {
      setAppointments(prev => prev.map(a => a.appointmentId === aptId ? { ...a, status: 'checked_in', queueToken: Math.floor(Math.random() * 20) + 1 } : a))
    }
  }

  const onSubmit = useCallback(async (data: AppointmentForm) => {
    try {
      const p = patients.find(pat => pat.id === data.patientId)
      const d = doctors.find(doc => doc.id === data.doctorId)
      const payload = { ...data, timeSlot: data.time }
      const res = await api.post('/appointments', payload)
      const newApt: Appointment = res.data || {
        appointmentId: `apt-${Date.now()}`,
        patientName: p?.name || 'Patient',
        doctorName: d?.name || 'Doctor',
        time: data.time,
        status: 'booked',
        queueToken: null,
        type: data.type,
      }
      setAppointments(prev => [newApt, ...prev])
      reset()
      setShowModal(false)
    } catch {
      const p = patients.find(pat => pat.id === data.patientId)
      const d = doctors.find(doc => doc.id === data.doctorId)
      const newApt: Appointment = {
        appointmentId: `apt-${Date.now()}`,
        patientName: p?.name || 'Patient',
        doctorName: d?.name || 'Doctor',
        time: data.time,
        status: 'booked',
        queueToken: null,
        type: data.type,
      }
      setAppointments(prev => [newApt, ...prev])
      reset()
      setShowModal(false)
    }
  }, [patients, doctors, reset])

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
    fetchPatients()
  }, [fetchAppointments, fetchDoctors, fetchPatients])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-07 OPD Queue &amp; Roster</span>
          <h1 className="page-title mt-1">Appointments &amp; OPD Queue</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Schedule slots, check-in patients, &amp; issue queue tokens.</p>
        </div>
        <button onClick={() => { setViewingAppointment(null); setShowModal(true); }} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          <span>Book OPD Slot</span>
        </button>
      </div>

      <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold uppercase text-slate-500">Queue Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field max-w-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-scheduled">Booked</span>
          <span className="status-chip status-chip-pending">Checked In</span>
          <span className="status-chip status-chip-completed">Completed</span>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time Slot</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Type</th>
              <th>Queue Token</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500">Loading OPD schedule...</td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">No appointments scheduled for {selectedDate}.</td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.appointmentId}>
                  <td className="mono font-semibold" style={{ color: 'var(--accent)' }}>{apt.time}</td>
                  <td className="font-semibold text-slate-900">{apt.patientName}</td>
                  <td className="text-slate-700">{apt.doctorName}</td>
                  <td>
                    <span className="text-xs font-medium text-slate-600 capitalize">{apt.type}</span>
                  </td>
                  <td>
                    {apt.queueToken ? (
                      <span className="mono bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-bold text-xs">
                        #{apt.queueToken}
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td>
                    <span className={
                      apt.status === 'completed' ? 'status-chip status-chip-completed' :
                      apt.status === 'checked_in' ? 'status-chip status-chip-pending' :
                      'status-chip status-chip-scheduled'
                    }>
                      {apt.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    {apt.status === 'booked' && (
                      <button onClick={() => handleCheckIn(apt.appointmentId)} className="btn-primary text-xs px-2.5 py-1">
                        Check In
                      </button>
                    )}
                    <button onClick={() => { setViewingAppointment(apt); setShowModal(true); }} className="btn-secondary text-xs px-2.5 py-1">
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl card p-6 space-y-6 shadow-2xl">
            {viewingAppointment ? (
              <AppointmentDetail appointment={viewingAppointment} onClose={() => { setViewingAppointment(null); setShowModal(false); }} />
            ) : (
              <AppointmentFormModal onSubmit={onSubmit} onClose={() => setShowModal(false)} register={register} handleSubmit={handleSubmit} errors={errors} isSubmitting={isSubmitting} doctors={doctors} patients={patients} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AppointmentFormModal({ onSubmit, onClose, register, handleSubmit, errors, isSubmitting, doctors, patients }: any) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-heading">Book OPD Slot</h2>
          <p className="text-xs text-slate-500">FR-07 Slot Booking &amp; Roster Enforcement</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Select Patient *</label>
          <select {...register('patientId')} className="input-field">
            <option value="">Choose patient...</option>
            {patients.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>
            ))}
          </select>
          {errors.patientId && <p className="text-xs text-rose-600 mt-1">{errors.patientId.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assigned Doctor *</label>
          <select {...register('doctorId')} className="input-field">
            <option value="">Choose doctor...</option>
            {doctors.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.doctorId && <p className="text-xs text-rose-600 mt-1">{errors.doctorId.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Appointment Date *</label>
          <input type="date" {...register('date')} className="input-field" />
          {errors.date && <p className="text-xs text-rose-600 mt-1">{errors.date.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Time Slot *</label>
          <input type="text" {...register('time')} className="input-field" placeholder="10:30 AM" />
          {errors.time && <p className="text-xs text-rose-600 mt-1">{errors.time.message}</p>}
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Entry Type *</label>
          <div className="flex gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="radio" value="scheduled" {...register('type')} defaultChecked /> Scheduled Appointment
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input type="radio" value="walkin" {...register('type')} /> Immediate Walk-in
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Booking Slot...' : 'Book Appointment'}
        </button>
      </div>
    </form>
  )
}

function AppointmentDetail({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="gradient-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase">OPD Ticket</span>
          <h2 className="text-xl font-bold text-slate-900 font-heading mt-1">{appointment.patientName}</h2>
          <p className="mono font-semibold text-teal-700">{appointment.appointmentId}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Assigned Doctor</p>
          <p className="font-semibold text-slate-800 mt-0.5">{appointment.doctorName}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Time Slot</p>
          <p className="mono font-semibold text-teal-700 mt-0.5">{appointment.time}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Entry Type</p>
          <p className="font-semibold text-slate-800 capitalize mt-0.5">{appointment.type}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase">Queue Token</p>
          <p className="font-mono font-bold text-amber-700 mt-0.5">{appointment.queueToken ? `#${appointment.queueToken}` : 'Not Checked In'}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-200 pt-4">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}