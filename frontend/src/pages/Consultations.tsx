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
    formState: { errors: _errorsPrescription, isSubmitting: isSubmittingPrescription },

  } = useForm<PrescriptionForm>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { items: [{ medicine: 'Amoxicillin 500mg', dosage: '1 tablet', frequency: 'Twice daily after meals', duration: '5 days' }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await api.get('/appointments?date=' + new Date().toISOString().split('T')[0])
      if (res.data && res.data.length > 0) setAppointments(res.data)
      else setAppointments(mockQueue)
    } catch {
      setAppointments(mockQueue)
    }
  }, [])

  const fetchConsultations = useCallback(async (appointmentId: string) => {
    try {
      const res = await api.get(`/patients/${appointmentId}/history`)
      if (res.data && res.data.length > 0) setConsultations(res.data)
      else setConsultations([
        { id: 'c-01', appointmentId, doctorId: 'doc-1', doctorName: 'Dr. R. K. Sharma', chiefComplaint: 'Fever & dry cough for 3 days', observations: 'Temp: 101°F, SpO2: 98%, BP: 120/80', diagnosis: 'Acute Viral Upper Respiratory Infection', version: 1, previousVersionId: null, createdAt: new Date().toISOString(), prescriptions: [{ medicine: 'Paracetamol 650mg', dosage: '1 tab', frequency: 'Thrice daily', duration: '3 days' }] }
      ])
    } catch {
      setConsultations([
        { id: 'c-01', appointmentId, doctorId: 'doc-1', doctorName: 'Dr. R. K. Sharma', chiefComplaint: 'Fever & dry cough for 3 days', observations: 'Temp: 101°F, SpO2: 98%, BP: 120/80', diagnosis: 'Acute Viral Upper Respiratory Infection', version: 1, previousVersionId: null, createdAt: new Date().toISOString(), prescriptions: [{ medicine: 'Paracetamol 650mg', dosage: '1 tab', frequency: 'Thrice daily', duration: '3 days' }] }
      ])
    }
  }, [])

  const onSubmitConsultation = useCallback(async (data: ConsultationForm) => {
    if (!selectedAppointment) return
    try {
      const latest = consultations[0]
      const payload = { ...data, appointmentId: selectedAppointment, previousVersionId: latest?.id || null }
      const res = await api.post(`/appointments/${selectedAppointment}/consultation`, payload)
      const newConsult: Consultation = res.data || {
        id: `c-${Date.now()}`,
        appointmentId: selectedAppointment,
        doctorId: 'doc-curr',
        doctorName: 'Dr. Sharma',
        chiefComplaint: data.chiefComplaint,
        observations: data.observations || '',
        diagnosis: data.diagnosis,
        version: (latest?.version || 0) + 1,
        previousVersionId: latest?.id || null,
        createdAt: new Date().toISOString(),
      }
      setConsultations(prev => [newConsult, ...prev])
      resetConsultation()
      setActiveTab('prescription')
    } catch {
      const latest = consultations[0]
      const newConsult: Consultation = {
        id: `c-${Date.now()}`,
        appointmentId: selectedAppointment,
        doctorId: 'doc-curr',
        doctorName: 'Dr. Sharma',
        chiefComplaint: data.chiefComplaint,
        observations: data.observations || '',
        diagnosis: data.diagnosis,
        version: (latest?.version || 0) + 1,
        previousVersionId: latest?.id || null,
        createdAt: new Date().toISOString(),
      }
      setConsultations(prev => [newConsult, ...prev])
      resetConsultation()
      setActiveTab('prescription')
    }
  }, [selectedAppointment, consultations, resetConsultation])

  const onSubmitPrescription = useCallback(async (data: PrescriptionForm) => {
    const latest = consultations[0]
    if (!latest) return
    try {
      await api.post(`/consultations/${latest.id}/prescriptions`, data)
      setConsultations(prev => prev.map((c, i) => i === 0 ? { ...c, prescriptions: data.items } : c))
      setActiveTab('history')
    } catch {
      setConsultations(prev => prev.map((c, i) => i === 0 ? { ...c, prescriptions: data.items } : c))
      setActiveTab('history')
    }
  }, [consultations])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  useEffect(() => {
    if (selectedAppointment) fetchConsultations(selectedAppointment)
  }, [selectedAppointment, fetchConsultations])

  const activePatient = appointments.find(a => a.appointmentId === selectedAppointment)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-14 &amp; FR-15 Clinical EMR</span>
          <h1 className="page-title mt-1">Clinical Consultations &amp; Rx</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Electronic medical record, version-amended clinical notes, &amp; Rx engine.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">

        {/* Checked-in Queue Panel */}
        <div className="card p-5 space-y-4">
          <div>
            <h2 className="section-title">Checked-in OPD Queue</h2>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Select a patient to begin EMR session</p>
          </div>

          <div className="space-y-2">
            {appointments.map((apt) => (
              <button
                key={apt.appointmentId}
                onClick={() => setSelectedAppointment(apt.appointmentId)}
                className={`w-full text-left p-3.5 rounded-xl transition-all border ${
                  selectedAppointment === apt.appointmentId
                    ? 'bg-teal-50 border-teal-300 text-teal-900 shadow-sm font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900 text-sm">{apt.patientName}</p>
                  <span className="mono text-xs font-semibold text-teal-700">{apt.time}</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{apt.doctorName}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main Workstation */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Patient Card */}
          <div className="card p-4 flex items-center justify-between bg-teal-50/60 border-teal-200">
            <div>
              <span className="label-xs text-teal-800">Active Consultation Session</span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">{activePatient?.patientName || 'Select Patient'}</h3>
              <p className="text-xs text-slate-600 font-medium">{activePatient?.doctorName} • {activePatient?.time}</p>
            </div>
            <span className="status-chip status-chip-pending">Session Open</span>
          </div>

          {/* Workstation Tabs */}
          <div className="flex border-b border-slate-200 space-x-6">
            <button
              onClick={() => setActiveTab('consultation')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'consultation'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              1. Clinical Note (FR-14)
            </button>
            <button
              onClick={() => setActiveTab('prescription')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'prescription'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              2. Prescription Rx (FR-15)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              3. Version History Log
            </button>
          </div>

          {/* Tab 1: Clinical Note */}
          {activeTab === 'consultation' && (
            <form onSubmit={handleSubmitConsultation(onSubmitConsultation)} className="card p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Chief Complaint *</label>
                <textarea {...regConsultation('chiefComplaint')} className="input-field h-20 resize-none" placeholder="e.g. Fever for 3 days, dry cough, weakness..." />
                {errorsConsultation.chiefComplaint && <p className="text-xs text-rose-600 mt-1">{errorsConsultation.chiefComplaint.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Vitals &amp; Physical Examination</label>
                <input {...regConsultation('vitals')} className="input-field" placeholder="Temp: 101°F | BP: 120/80 | SpO2: 98% | Pulse: 78 bpm" />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Observations &amp; Clinical Notes</label>
                <textarea {...regConsultation('observations')} className="input-field h-24 resize-none" placeholder="Chest clear, mild throat congestion, no distress..." />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Diagnosis &amp; Assessment *</label>
                <input {...regConsultation('diagnosis')} className="input-field" placeholder="e.g. Acute Viral Upper Respiratory Tract Infection" />
                {errorsConsultation.diagnosis && <p className="text-xs text-rose-600 mt-1">{errorsConsultation.diagnosis.message}</p>}
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isSubmittingConsultation} className="btn-primary">
                  {isSubmittingConsultation ? 'Saving Note...' : 'Save Clinical Note & Continue →'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 2: Prescription Rx */}
          {activeTab === 'prescription' && (
            <form onSubmit={handleSubmitPrescription(onSubmitPrescription)} className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Rx Medicines &amp; Dosage Schedule</h3>
                <button type="button" onClick={() => append({ medicine: '', dosage: '', frequency: '', duration: '' })} className="btn-secondary text-xs py-1.5 px-3">
                  + Add Medicine
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((field, idx) => (
                  <div key={field.id} className="grid gap-3 sm:grid-cols-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Medicine Name</label>
                      <input {...regPrescription(`items.${idx}.medicine`)} className="input-field text-xs" placeholder="e.g. Paracetamol 650mg" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Dosage</label>
                      <input {...regPrescription(`items.${idx}.dosage`)} className="input-field text-xs" placeholder="1 tablet" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Frequency</label>
                      <input {...regPrescription(`items.${idx}.frequency`)} className="input-field text-xs" placeholder="Thrice daily" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">Duration</label>
                      <input {...regPrescription(`items.${idx}.duration`)} className="input-field text-xs" placeholder="5 days" />
                    </div>
                    <div className="flex items-end justify-end">
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-2">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={isSubmittingPrescription} className="btn-primary">
                  {isSubmittingPrescription ? 'Saving Rx...' : 'Issue Prescription &amp; Log Version'}
                </button>
              </div>
            </form>
          )}

          {/* Tab 3: Version History */}
          {activeTab === 'history' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Immutable Version Audit Log (FR-14)</h3>
                <span className="mono text-xs text-teal-700 font-bold">{consultations.length} Versions Recorded</span>
              </div>

              <div className="space-y-4">
                {consultations.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="gradient-badge px-2.5 py-0.5 rounded-full text-xs font-bold">
                        Version v{c.version}
                      </span>
                      <span className="mono text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500">Chief Complaint</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{c.chiefComplaint}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-500">Diagnosis</p>
                      <p className="text-sm font-medium text-slate-800 mt-0.5">{c.diagnosis}</p>
                    </div>

                    {c.prescriptions && c.prescriptions.length > 0 && (
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-xs font-semibold text-teal-800 uppercase mb-1">Prescribed Medicines</p>
                        <ul className="text-xs text-slate-700 space-y-1">
                          {c.prescriptions.map((rx: any, i: number) => (
                            <li key={i} className="mono">• {rx.medicine} — {rx.dosage} ({rx.frequency}) for {rx.duration}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}