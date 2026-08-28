import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const consultationSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  observations: z.string().optional(),
  diagnosis: z.string().min(1, 'Diagnosis is required'),
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

export default function Consultations() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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
    reset: resetPrescription,
    control,
    formState: { errors: errorsPrescription, isSubmitting: isSubmittingPrescription },
  } = useForm<PrescriptionForm>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { items: [{ medicine: '', dosage: '', frequency: '', duration: '' }] },
  })

  const fetchAppointments = useCallback(async () => {
    try {
      const res = await api.get('/appointments?date=' + new Date().toISOString().split('T')[0])
      setAppointments(res.data.filter((a: any) => a.status === 'checked_in' || a.status === 'completed'))
    } catch (err) {
      console.error('Failed to fetch appointments:', err)
    }
  }, [])

  const fetchConsultations = useCallback(async (appointmentId: string) => {
    setLoading(true)
    try {
      const res = await api.get(`/patients/${appointmentId}/history`)
      setConsultations(res.data)
    } catch (err) {
      console.error('Failed to fetch consultations:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmitConsultation = useCallback(async (data: ConsultationForm) => {
    try {
      await api.post(`/appointments/${selectedAppointment}/consultation`, data)
      resetConsultation()
      fetchConsultations(selectedAppointment!)
      setActiveTab('prescription')
    } catch (err: any) {
      console.error('Failed to create consultation:', err)
      alert(err.response?.data?.error || 'Failed to create consultation')
    }
  }, [selectedAppointment, fetchConsultations])

  const onSubmitPrescription = useCallback(async (data: PrescriptionForm) => {
    if (!selectedAppointment) return
    try {
      const consultation = consultations.find(c => c.appointmentId === selectedAppointment)
      if (!consultation) return
      await api.post(`/consultations/${consultation.id}/prescription`, data)
      resetPrescription({ items: [{ medicine: '', dosage: '', frequency: '', duration: '' }] })
      fetchConsultations(selectedAppointment)
      alert('Prescription saved successfully')
    } catch (err: any) {
      console.error('Failed to create prescription:', err)
      alert(err.response?.data?.error || 'Failed to create prescription')
    }
  }, [selectedAppointment, consultations, fetchConsultations])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  useEffect(() => {
    if (selectedAppointment) {
      fetchConsultations(selectedAppointment)
    }
  }, [selectedAppointment, fetchConsultations])

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Consultations</h1>
          <p className="page-subtitle">Clinical notes and prescriptions</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 card-glass">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Today's Checked-in Patients</h2>
          <div className="space-y-2">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-3 animate-pulse">
                  <div className="h-4 w-3/4 bg-slate-200 rounded mb-1" />
                  <div className="h-3 w-1/2 bg-slate-200 rounded" />
                </div>
              ))
            ) : appointments.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No checked-in patients</p>
            ) : (
              appointments.map((apt) => (
                <button
                  key={apt.appointmentId}
                  onClick={() => { setSelectedAppointment(apt.appointmentId); setActiveTab('consultation'); }}
                  className={`w-full text-left p-3 rounded-xl transition-colors ${selectedAppointment === apt.appointmentId ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50'}`}
                >
                  <p className="font-medium text-slate-900">{apt.patientName}</p>
                  <p className="text-sm text-slate-500">{apt.time} • Dr. {apt.doctorName}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 card-glass">
          {!selectedAppointment ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-500">
              <FileTextIcon className="w-16 h-16 text-slate-300 mb-4" aria-hidden="true" />
              <p className="text-lg">Select a patient to view or create consultation</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-slate-100">
                <nav className="flex gap-4 -mb-px" aria-label="Tabs">
                  <button
                    onClick={() => setActiveTab('consultation')}
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'consultation' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Consultation Note
                  </button>
                  <button
                    onClick={() => setActiveTab('prescription')}
                    className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'prescription' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                  >
                    Prescription
                  </button>
                  {consultations.length > 0 && (
                    <button
                      onClick={() => setActiveTab('history')}
                      className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                      History ({consultations.length})
                    </button>
                  )}
                </nav>
              </div>

              {activeTab === 'consultation' && (
                <ConsultationForm
                  onSubmit={handleSubmitConsultation(onSubmitConsultation)}
                  register={regConsultation}
                  errors={errorsConsultation}
                  isSubmitting={isSubmittingConsultation}
                  onCancel={() => setSelectedAppointment(null)}
                />
              )}

              {activeTab === 'prescription' && (
                <PrescriptionForm
                  onSubmit={handleSubmitPrescription(onSubmitPrescription)}
                  register={regPrescription}
                  control={control}
                  errors={errorsPrescription}
                  isSubmitting={isSubmittingPrescription}
                  onCancel={() => setSelectedAppointment(null)}
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

function ConsultationForm({ onSubmit, register, errors, isSubmitting, onCancel }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label htmlFor="chiefComplaint" className="label">Chief Complaint *</label>
        <textarea id="chiefComplaint" {...register('chiefComplaint')} className="input min-h-[100px] resize-y" placeholder="Patient's main concern..." />
        {errors.chiefComplaint && <p className="text-sm text-rose-600 mt-1">{errors.chiefComplaint.message}</p>}
      </div>
      <div>
        <label htmlFor="observations" className="label">Observations</label>
        <textarea id="observations" {...register('observations')} className="input min-h-[100px] resize-y" placeholder="Clinical findings, examination notes..." />
      </div>
      <div>
        <label htmlFor="diagnosis" className="label">Diagnosis *</label>
        <textarea id="diagnosis" {...register('diagnosis')} className="input min-h-[80px] resize-y" placeholder="Diagnosis and assessment..." />
        {errors.diagnosis && <p className="text-sm text-rose-600 mt-1">{errors.diagnosis.message}</p>}
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : 'Save Consultation'}
        </button>
      </div>
    </form>
  )
}

function PrescriptionForm({ onSubmit, register, control, errors, isSubmitting, onCancel }: any) {
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-slate-900">Medicines</h3>
          <button type="button" onClick={() => append({ medicine: '', dosage: '', frequency: '', duration: '' })} className="btn-secondary text-sm">
            <PlusIcon className="w-4 h-4" aria-hidden="true" />
            Add Medicine
          </button>
        </div>
        <div className="space-y-4">
          {fields.map((field: any, index: number) => (
            <div key={field.id} className="grid gap-3 sm:grid-cols-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div className="sm:col-span-2">
                <label className="label">Medicine *</label>
                <input {...register(`items.${index}.medicine`)} className="input" placeholder="e.g., Paracetamol" />
                {errors.items?.[index]?.medicine && <p className="text-sm text-rose-600 mt-1">{errors.items[index].medicine.message}</p>}
              </div>
              <div>
                <label className="label">Dosage *</label>
                <input {...register(`items.${index}.dosage`)} className="input" placeholder="e.g., 500mg" />
                {errors.items?.[index]?.dosage && <p className="text-sm text-rose-600 mt-1">{errors.items[index].dosage.message}</p>}
              </div>
              <div>
                <label className="label">Frequency *</label>
                <input {...register(`items.${index}.frequency`)} className="input" placeholder="e.g., 3 times daily" />
                {errors.items?.[index]?.frequency && <p className="text-sm text-rose-600 mt-1">{errors.items[index].frequency.message}</p>}
              </div>
              <div>
                <label className="label">Duration *</label>
                <input {...register(`items.${index}.duration`)} className="input" placeholder="e.g., 5 days" />
                {errors.items?.[index]?.duration && <p className="text-sm text-rose-600 mt-1">{errors.items[index].duration.message}</p>}
              </div>
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="btn-ghost p-1.5 self-end text-rose-600 hover:bg-rose-50" aria-label="Remove medicine">
                  <TrashIcon className="w-5 h-5" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving...' : 'Save Prescription'}
        </button>
      </div>
    </form>
  )
}

function ConsultationHistory({ consultations }: { consultations: Consultation[] }) {
  return (
    <div className="space-y-4">
      {consultations.map((c) => (
        <div key={c.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-medium text-slate-900">{c.chiefComplaint}</p>
              <p className="text-sm text-slate-500">v{c.version} • {new Date(c.createdAt).toLocaleDateString()} • Dr. {c.doctorName}</p>
            </div>
            {c.previousVersionId && <span className="badge-warning">Amended</span>}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            <div><span className="text-slate-500">Diagnosis: </span><span className="font-medium">{c.diagnosis}</span></div>
            <div><span className="text-slate-500">Prescriptions: </span><span>{c.prescriptions?.length || 0}</span></div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
}