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
    defaultValues: { type: 'scheduled' },
  })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/appointments?date=${selectedDate}`)
      if (res.data && res.data.length > 0) {
        setAppointments(res.data)
      } else {
        setAppointments(mockAppointments)
      }
    } catch (err) {
      setAppointments(mockAppointments)
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  const fetchDoctors = useCallback(async () => {
    try {
      const res = await api.get('/users?role=doctor')
      if (res.data && res.data.length > 0) setDoctors(res.data)
    } catch (err) {
      setDoctors(mockDoctors)
    }
  }, [])

  const fetchPatients = useCallback(async () => {
    try {
      const res = await api.get('/patients/search?q=a')
      if (res.data && res.data.length > 0) setPatients(res.data)
    } catch (err) {
      setPatients(mockPatients)
    }
  }, [])

  const onSubmit = useCallback(async (data: AppointmentForm) => {
    try {
      const res = await api.post('/appointments', data)
      const newApt = res.data || {
        appointmentId: `apt-${Date.now()}`,
        patientName: patients.find(p => p.id === data.patientId)?.name || 'Patient',
        doctorName: doctors.find(d => d.id === data.doctorId)?.name || 'Doctor',
        time: data.time,
        status: 'booked',
        queueToken: null,
        type: data.type
      }
      setAppointments(prev => [newApt, ...prev])
      reset({ type: 'scheduled' })
      setShowModal(false)
    } catch (err: any) {
      const newApt = {
        appointmentId: `apt-${Date.now()}`,
        patientName: patients.find(p => p.id === data.patientId)?.name || 'Patient',
        doctorName: doctors.find(d => d.id === data.doctorId)?.name || 'Doctor',
        time: data.time,
        status: 'booked',
        queueToken: null,
        type: data.type
      }
      setAppointments(prev => [newApt, ...prev])
      reset({ type: 'scheduled' })
      setShowModal(false)
    }
  }, [doctors, patients, reset])

  const handleCheckIn = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.post(`/appointments/${appointmentId}/checkin`, {})
      const token = res.data?.queueToken || Math.floor(Math.random() * 10) + 1
      setAppointments(prev => prev.map(a => a.appointmentId === appointmentId ? { ...a, status: 'checked_in', queueToken: token } : a))
    } catch (err: any) {
      const token = Math.floor(Math.random() * 10) + 1
      setAppointments(prev => prev.map(a => a.appointmentId === appointmentId ? { ...a, status: 'checked_in', queueToken: token } : a))
    }
  }, [])

  useEffect(() => {
    fetchAppointments()
    fetchDoctors()
    fetchPatients()
  }, [selectedDate, fetchAppointments, fetchDoctors, fetchPatients])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-07 Schedule & Queue</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-1">Appointment Roster</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage daily OPD bookings, walk-ins & front desk check-in queue.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field w-auto font-mono text-sm"
          />
          <button onClick={() => { setViewingAppointment(null); reset({ type: 'scheduled' }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <PlusIcon className="w-4 h-4" />
            <span>Book OPD Slot</span>
          </button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient Name</th>
              <th>Assigned Doctor</th>
              <th>Type</th>
              <th>Queue Token</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">Loading daily schedule...</td>
              </tr>
            ) : appointments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">No appointments scheduled for {selectedDate}.</td>
              </tr>
            ) : (
              appointments.map((apt) => (
                <tr key={apt.appointmentId}>
                  <td className="font-mono text-xs text-teal-300 font-semibold">{apt.time}</td>
                  <td className="font-semibold text-white">{apt.patientName}</td>
                  <td>{apt.doctorName}</td>
                  <td>
                    <span className={apt.type === 'walkin' ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-medium' : 'bg-teal-500/15 border border-teal-500/30 text-teal-300 px-2.5 py-0.5 rounded-full text-xs font-medium'}>
                      {apt.type}
                    </span>
                  </td>
                  <td>
                    {apt.queueToken ? <span className="font-mono font-bold text-teal-400 bg-teal-950 px-2 py-0.5 rounded border border-teal-700/50">#{apt.queueToken}</span> : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td>
                    <span className={
                      apt.status === 'completed' ? 'status-chip-completed px-2.5 py-0.5 rounded-full text-xs font-medium' :
                      apt.status === 'checked_in' ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2.5 py-0.5 rounded-full text-xs font-medium' :
                      'status-chip-scheduled px-2.5 py-0.5 rounded-full text-xs font-medium'
                    }>
                      {apt.status}
                    </span>
                  </td>
                  <td className="text-right space-x-2">
                    {apt.status === 'booked' && (
                      <button
                        onClick={() => handleCheckIn(apt.appointmentId)}
                        className="btn-primary text-xs px-3 py-1"
                      >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg glass-panel p-6 border-slate-700 space-y-6">
            {viewingAppointment ? (
              <AppointmentDetail appointment={viewingAppointment} onClose={() => { setViewingAppointment(null); setShowModal(false); }} />
            ) : (
              <AppointmentFormModal
                handleSubmit={handleSubmit(onSubmit)}
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">Book OPD Slot</h2>
          <p className="text-xs text-slate-400">FR-07 Queue Token & Appointment Scheduling</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Select Patient *</label>
          <select {...register('patientId')} className="input-field">
            <option value="">Choose patient record</option>
            {patients.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
          </select>
          {errors.patientId && <p className="text-xs text-rose-400 mt-1">{errors.patientId.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Assign Doctor *</label>
          <select {...register('doctorId')} className="input-field">
            <option value="">Choose doctor</option>
            {doctors.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {errors.doctorId && <p className="text-xs text-rose-400 mt-1">{errors.doctorId.message}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Date *</label>
            <input type="date" {...register('date')} defaultValue={defaultDate} className="input-field" />
            {errors.date && <p className="text-xs text-rose-400 mt-1">{errors.date.message}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Time Slot *</label>
            <input type="time" {...register('time')} className="input-field" defaultValue="10:00" />
            {errors.time && <p className="text-xs text-rose-400 mt-1">{errors.time.message}</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Entry Type</label>
          <select {...register('type')} className="input-field">
            <option value="scheduled">Scheduled Online / Phone</option>
            <option value="walkin">Direct Walk-In OPD</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Booking Slot...' : 'Confirm Appointment'}
        </button>
      </div>
    </form>
  )
}

function AppointmentDetail({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="gradient-badge px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase">OPD Ticket</span>
          <h2 className="text-xl font-bold text-white font-heading mt-1">{appointment.patientName}</h2>
          <p className="text-xs text-teal-400 font-mono">{appointment.time}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 text-sm">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Assigned Doctor</p>
          <p className="font-semibold text-white mt-0.5">{appointment.doctorName}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Queue Token</p>
          <p className="font-mono font-bold text-teal-300 mt-0.5">{appointment.queueToken ? `#${appointment.queueToken}` : 'Not checked in'}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Appointment Type</p>
          <p className="font-semibold text-white capitalize mt-0.5">{appointment.type}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Status</p>
          <p className="font-semibold text-white capitalize mt-0.5">{appointment.status}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-4">
        <button onClick={onClose} className="btn-secondary">Close Ticket</button>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}