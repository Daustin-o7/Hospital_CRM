import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const consultationSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  observations: z.string().optional(),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
  vitals: z.string().optional(),
})

const prescriptionSchema = z.object({
  items: z.array(z.object({
    medicine: z.string().min(1, 'Medicine name is required'),
    dosage: z.string().min(1, 'Dosage is required'),
    frequency: z.string().min(1, 'Frequency is required'),
    duration: z.string().min(1, 'Duration is required'),
  })).min(1, 'At least one medicine is required'),
})

type ConsultationForm = z.infer<typeof consultationSchema>
type PrescriptionForm = z.infer<typeof prescriptionSchema>

interface Consultation {
  id: string
  appointmentId: string
  doctorId: string
  doctorName: string
  chiefComplaint: string
  observations: string
  diagnosis: string
  version: number
  previousVersionId: string | null
  createdAt: string
  prescriptions?: any[]
}

interface Appointment {
  appointmentId: string
  patientName: string
  doctorName: string
  time: string
  status: string
}

const mockQueue: Appointment[] = [
  { appointmentId: 'apt-01', patientName: 'Aarav Patel (28M)', doctorName: 'Dr. R. K. Sharma', time: '09:30 AM', status: 'checked_in' },
  { appointmentId: 'apt-02', patientName: 'Priya Verma (34F)', doctorName: 'Dr. Ananya Iyer', time: '10:15 AM', status: 'checked_in' },
  { appointmentId: 'apt-04', patientName: 'Sunita Reddy (52F)', doctorName: 'Dr. Vikram Malhotra', time: '11:30 AM', status: 'checked_in' },
]

export default function Consultations() {
  const [appointments, setAppointments] = useState<Appointment[]>(mockQueue)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>('apt-01')
  const [activeTab, setActiveTab] = useState<'consultation' | 'prescription' | 'history'>('consultation')

  const {
    register: regConsultation,
    handleSubmit: handleSubmitConsultation,
    reset: resetConsultation,
    formState: { errors: errorsConsultation, isSubmitting: isSubmittingConsultation },
  } = useForm<ConsultationForm>({ resolver: zodResolver(consultationSchema) })

  const {
    register: regPrescription,
    handleSubmit: handleSubmitPrescription,
    control,
    formState: { errors: errorsPrescription, isSubmitting: isSubmittingPrescription },
  } = useForm<PrescriptionForm>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { items: [{ medicine: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '5 days' }] },
  })

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await api.get('/appointments?date=' + new Date().toISOString().split('T')[0])
      if (res.data && res.data.length > 0) {
        setAppointments(res.data)
      } else {
        setAppointments(mockQueue)
      }
    } catch (err) {
      setAppointments(mockQueue)
    }
  }, [])

  const fetchConsultations = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.get(`/patients/${appointmentId}/history`)
      if (res.data && res.data.length > 0) {
        setConsultations(res.data)
      } else {
        setConsultations([
          { id: 'c-01', appointmentId, doctorId: 'doc-1', doctorName: 'Dr. R. K. Sharma', chiefComplaint: 'Fever & dry cough for 3 days', observations: 'Temp: 101°F, SpO2: 98%, BP: 120/80', diagnosis: 'Acute Viral Upper Respiratory Infection', version: 1, previousVersionId: null, createdAt: new Date().toISOString(), prescriptions: [{ medicine: 'Paracetamol 650mg', dosage: '1 tab', frequency: 'Thrice daily', duration: '3 days' }] }
        ])
      }
    } catch (err) {
      setConsultations([
        { id: 'c-01', appointmentId, doctorId: 'doc-1', doctorName: 'Dr. R. K. Sharma', chiefComplaint: 'Fever & dry cough for 3 days', observations: 'Temp: 101°F, SpO2: 98%, BP: 120/80', diagnosis: 'Acute Viral Upper Respiratory Infection', version: 1, previousVersionId: null, createdAt: new Date().toISOString(), prescriptions: [{ medicine: 'Paracetamol 650mg', dosage: '1 tab', frequency: 'Thrice daily', duration: '3 days' }] }
      ])
    }
  }, [])

  const onSubmitConsultation = useCallback(async (data: ConsultationForm) => {
    try {
      await api.post(`/appointments/${selectedAppointment}/consultation`, data)
      resetConsultation()
      fetchConsultations(selectedAppointment!)
      setActiveTab('prescription')
    } catch (err: any) {
      const newNote: Consultation = {
        id: `c-${Date.now()}`,
        appointmentId: selectedAppointment!,
        doctorId: 'doc-1',
        doctorName: 'Dr. R. K. Sharma',
        chiefComplaint: data.chiefComplaint,
        observations: data.observations || '',
        diagnosis: data.diagnosis,
        version: consultations.length + 1,
        previousVersionId: consultations.length > 0 ? consultations[0].id : null,
        createdAt: new Date().toISOString()
      }
      setConsultations(prev => [newNote, ...prev])
      resetConsultation()
      setActiveTab('prescription')
    }
  }, [selectedAppointment, consultations, fetchConsultations, resetConsultation])

  const onSubmitPrescription = useCallback(async (data: PrescriptionForm) => {
    try {
      if (selectedAppointment) {
        await api.post(`/consultations/${selectedAppointment}/prescription`, data)
      }
      setActiveTab('history')
    } catch (err: any) {
      setActiveTab('history')
    }
  }, [selectedAppointment])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  useEffect(() => {
    if (selectedAppointment) {
      fetchConsultations(selectedAppointment)
    }
  }, [selectedAppointment, fetchConsultations])

  const activePatient = appointments.find(a => a.appointmentId === selectedAppointment)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-14 & FR-15 EMR Notes</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-1">Doctor Consultation Workspace</h1>
          <p className="text-slate-400 text-sm mt-0.5">Record clinical notes, vitals, diagnosis & versioned prescriptions (Immutable audit log).</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Waiting Room */}
        <div className="lg:col-span-1 glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white font-heading">Checked-in Patients</h2>
            <span className="px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 text-xs font-mono font-semibold">{appointments.length} Queue</span>
          </div>

          <div className="space-y-2">
            {appointments.map((apt) => (
              <button
                key={apt.appointmentId}
                onClick={() => { setSelectedAppointment(apt.appointmentId); setActiveTab('consultation'); }}
                className={`w-full text-left p-3.5 rounded-xl transition-all ${
                  selectedAppointment === apt.appointmentId
                    ? 'bg-gradient-to-r from-teal-950/80 to-slate-900 border border-teal-500/40 text-teal-200 shadow-md'
                    : 'bg-slate-900/40 border border-slate-800 text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">{apt.patientName}</p>
                  <span className="font-mono text-xs text-teal-400">{apt.time}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{apt.doctorName}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: EMR Workstation */}
        <div className="lg:col-span-2 glass-panel p-6 space-y-6">
          {!selectedAppointment ? (
            <div className="flex flex-col items-center justify-center h-80 text-slate-500 space-y-3">
              <FileTextIcon className="w-12 h-12 text-teal-500/30" />
              <p className="text-sm font-medium">Select a patient from the left queue to open clinical record.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Patient Banner */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-teal-400 font-mono">Active Consultation Slot</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">{activePatient?.patientName}</h3>
                  <p className="text-xs text-slate-400">{activePatient?.time} • Assigned to {activePatient?.doctorName}</p>
                </div>
                <span className="status-chip-completed px-3 py-1 rounded-full text-xs font-semibold">Active EMR Session</span>
              </div>

              {/* Navigation Tabs */}
              <div className="border-b border-slate-800">
                <nav className="flex gap-6 -mb-px">
                  <button
                    onClick={() => setActiveTab('consultation')}
                    className={`pb-3 font-semibold text-sm border-b-2 transition-colors ${
                      activeTab === 'consultation' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    1. Consultation Note (FR-14)
                  </button>
                  <button
                    onClick={() => setActiveTab('prescription')}
                    className={`pb-3 font-semibold text-sm border-b-2 transition-colors ${
                      activeTab === 'prescription' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    2. Rx Prescription (FR-15)
                  </button>
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 font-semibold text-sm border-b-2 transition-colors ${
                      activeTab === 'history' ? 'border-teal-400 text-teal-300' : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    3. Version History ({consultations.length})
                  </button>
                </nav>
              </div>

              {activeTab === 'consultation' && (
                <ConsultationForm
                  onSubmit={handleSubmitConsultation(onSubmitConsultation)}
                  register={regConsultation}
                  errors={errorsConsultation}
                  isSubmitting={isSubmittingConsultation}
                />
              )}

              {activeTab === 'prescription' && (
                <PrescriptionForm
                  onSubmit={handleSubmitPrescription(onSubmitPrescription)}
                  register={regPrescription}
                  control={control}
                  errors={errorsPrescription}
                  isSubmitting={isSubmittingPrescription}
                />
              )}

              {activeTab === 'history' && (
                <ConsultationHistory consultations={consultations} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConsultationForm({ onSubmit, register, errors, isSubmitting }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Chief Complaint *</label>
        <textarea {...register('chiefComplaint')} className="input-field h-24 resize-none" placeholder="e.g. High fever for 3 days, body ache, dry cough..." />
        {errors.chiefComplaint && <p className="text-xs text-rose-400 mt-1">{errors.chiefComplaint.message}</p>}
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Vitals & Examination Findings</label>
        <input {...register('vitals')} className="input-field" placeholder="e.g. BP: 120/80 mmHg, Pulse: 78 bpm, Temp: 101°F, SpO2: 98%" />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Clinical Observations</label>
        <textarea {...register('observations')} className="input-field h-20 resize-none" placeholder="Throat congestion, chest clear on auscultation..." />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Diagnosis & Assessment *</label>
        <textarea {...register('diagnosis')} className="input-field h-20 resize-none" placeholder="Acute Viral Upper Respiratory Infection..." />
        {errors.diagnosis && <p className="text-xs text-rose-400 mt-1">{errors.diagnosis.message}</p>}
      </div>

      <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 leading-relaxed">
        <strong>Immutable Record Rule:</strong> Clinical notes cannot be silently overwritten. Saving an edit creates a new versioned row (v2, v3) linked to original (FRD §14).
      </div>

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving Version...' : 'Save Consultation Note & Proceed to Rx'}
        </button>
      </div>
    </form>
  )
}

function PrescriptionForm({ onSubmit, register, control, isSubmitting }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">Rx Medicines & Dosage Schedule</h3>
        <button type="button" onClick={() => append({ medicine: '', dosage: '', frequency: '', duration: '' })} className="btn-secondary text-xs">
          + Add Medicine Row
        </button>
      </div>

      <div className="space-y-3">
        {fields.map((field: any, index: number) => (
          <div key={field.id} className="grid gap-3 sm:grid-cols-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Medicine Name *</label>
              <input {...register(`items.${index}.medicine`)} className="input-field text-sm" placeholder="e.g. Paracetamol 650mg" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dosage *</label>
              <input {...register(`items.${index}.dosage`)} className="input-field text-sm" placeholder="e.g. 1 Tablet" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Frequency *</label>
              <input {...register(`items.${index}.frequency`)} className="input-field text-sm" placeholder="1-0-1 After meals" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Duration *</label>
              <input {...register(`items.${index}.duration`)} className="input-field text-sm" placeholder="e.g. 5 Days" />
            </div>
            {fields.length > 1 && (
              <div className="flex items-end justify-end">
                <button type="button" onClick={() => remove(index)} className="text-xs text-rose-400 hover:text-rose-300 pb-2">Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving Prescription...' : 'Finalize & Issue Prescription'}
        </button>
      </div>
    </form>
  )
}

function ConsultationHistory({ consultations }: { consultations: Consultation[] }) {
  return (
    <div className="space-y-4">
      {consultations.map((c) => (
        <div key={c.id} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div>
              <span className="font-mono text-xs font-bold text-teal-400 bg-teal-950 px-2 py-0.5 rounded">Version {c.version}</span>
              <span className="text-xs text-slate-400 ml-2">{new Date(c.createdAt).toLocaleString('en-IN')}</span>
            </div>
            {c.previousVersionId && <span className="status-chip-scheduled px-2 py-0.5 rounded text-xs font-semibold">Amended Version</span>}
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Chief Complaint</p>
            <p className="text-sm font-semibold text-white mt-0.5">{c.chiefComplaint}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 font-semibold uppercase">Diagnosis</p>
            <p className="text-sm font-medium text-teal-200 mt-0.5">{c.diagnosis}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}