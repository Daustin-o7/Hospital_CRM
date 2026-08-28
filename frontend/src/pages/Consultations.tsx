import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'

// ── Schemas ───────────────────────────────────────────────────────────────────
const consultationSchema = z.object({
  chiefComplaint: z.string().min(1, 'Chief complaint is required'),
  observations:   z.string().optional(),
  diagnosis:      z.string().min(1, 'Diagnosis is required'),
  vitals:         z.string().optional(),
})
const prescriptionSchema = z.object({
  items: z.array(z.object({
    medicine:  z.string().min(1, 'Medicine name required'),
    dosage:    z.string().min(1, 'Dosage required'),
    frequency: z.string().min(1, 'Frequency required'),
    duration:  z.string().min(1, 'Duration required'),
  })).min(1, 'At least one medicine required'),
})
type ConsultationForm = z.infer<typeof consultationSchema>
type PrescriptionForm  = z.infer<typeof prescriptionSchema>

interface Consultation {
  id: string; appointmentId: string; doctorName: string
  chiefComplaint: string; observations: string; diagnosis: string
  version: number; previousVersionId: string | null; createdAt: string; prescriptions?: any[]
}
interface Appointment {
  appointmentId: string; patientName: string; doctorName: string; time: string; status: string
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }
  catch { return '—' }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Consultations() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'consultation' | 'prescription' | 'history'>('consultation')
  const [consultError, setConsultError] = useState('')
  const [loading, setLoading] = useState(true)

  const selectedAppt = appointments.find(a => a.appointmentId === selectedAppointment)

  const { register: regC, handleSubmit: handleC, reset: resetC, formState: { errors: errC, isSubmitting: isSubC } } =
    useForm<ConsultationForm>({ resolver: zodResolver(consultationSchema) })

  const { register: regP, handleSubmit: handleP, control, formState: { isSubmitting: isSubP } } =
    useForm<PrescriptionForm>({
      resolver: zodResolver(prescriptionSchema),
      defaultValues: { items: [{ medicine: '', dosage: '', frequency: '', duration: '' }] },
    })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/v1/appointments?date=' + new Date().toISOString().split('T')[0])
      const all = Array.isArray(res.data) ? res.data : []
      setAppointments(all)
      if (all.length > 0 && !selectedAppointment) setSelectedAppointment(all[0].appointmentId)
    } catch {
      setAppointments([])
    } finally {
      setLoading(false)
    }
  }, [selectedAppointment])

  const fetchConsultations = useCallback(async (aptId: string) => {
    try {
      const res = await api.get(`/v1/appointments/${aptId}/consultation`)
      setConsultations(Array.isArray(res.data) ? res.data : [res.data].filter(Boolean))
    } catch {
      setConsultations([])
    }
  }, [])

  const onSubmitConsultation = useCallback(async (data: ConsultationForm) => {
    if (!selectedAppointment) return
    setConsultError('')
    try {
      const latest = consultations[0]
      const res = await api.post(`/v1/appointments/${selectedAppointment}/consultation`, {
        ...data, previousVersionId: latest?.id ?? null,
      })
      const newC: Consultation = res.data ?? {
        id: `c-${Date.now()}`, appointmentId: selectedAppointment, doctorName: 'Dr. Sharma',
        chiefComplaint: data.chiefComplaint, observations: data.observations ?? '', diagnosis: data.diagnosis,
        version: (latest?.version ?? 0) + 1, previousVersionId: latest?.id ?? null, createdAt: new Date().toISOString(),
      }
      setConsultations(prev => [newC, ...prev])
      resetC()
      setActiveTab('prescription')
    } catch (err: any) {
      setConsultError(friendlyError(err))
    }
  }, [selectedAppointment, consultations, resetC])

  const onSubmitPrescription = useCallback(async (data: PrescriptionForm) => {
    const latest = consultations[0]
    if (!latest) return
    try {
      await api.post(`/v1/consultations/${latest.id}/prescriptions`, data)
      setConsultations(prev => prev.map((c, i) => i === 0 ? { ...c, prescriptions: data.items } : c))
      setActiveTab('history')
    } catch {}
  }, [consultations])

  useEffect(() => { fetchAppointments() }, [fetchAppointments])
  useEffect(() => { if (selectedAppointment) fetchConsultations(selectedAppointment) }, [selectedAppointment, fetchConsultations])

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Consultations</h1>
          <p className="page-description">Record clinical notes, diagnoses, and prescriptions.</p>
        </div>
      </div>

      {/* ── Split-pane layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>

        {/* Left: Patient list ── */}
        <div className="card" style={{ overflow: 'hidden', position: 'sticky', top: 'calc(var(--topbar-height) + 16px)' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
              Today's patients
            </span>
          </div>
          {loading ? (
            <div style={{ padding: 16 }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 52, marginBottom: 6, borderRadius: 'var(--radius-md)', background: '#f1f5f9' }} />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
              No patients today
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {appointments.map(appt => (
                <button
                  key={appt.appointmentId}
                  onClick={() => { setSelectedAppointment(appt.appointmentId); setConsultations([]); setActiveTab('consultation') }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: selectedAppointment === appt.appointmentId ? 'var(--brand-primary-20)' : 'transparent',
                    background: selectedAppointment === appt.appointmentId ? 'var(--brand-primary-10)' : 'transparent',
                    cursor: 'pointer',
                    marginBottom: 2,
                    transition: 'all 150ms',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, color: selectedAppointment === appt.appointmentId ? 'var(--brand-primary)' : 'var(--color-text)' }}>
                    {appt.patientName}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {appt.time} · {appt.doctorName}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Consultation workspace ── */}
        <div>
          {!selectedAppointment ? (
            <div className="card">
              <EmptyState
                icon={<NoteIcon />}
                title="Select a patient"
                description="Choose a patient from the left panel to record a consultation."
              />
            </div>
          ) : (
            <div>
              {/* Patient context header */}
              {selectedAppt && (
                <div className="card" style={{ padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="avatar">{selectedAppt.patientName.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{selectedAppt.patientName}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)' }}>{selectedAppt.doctorName} · {selectedAppt.time}</div>
                  </div>
                  <Badge variant={consultations.length > 0 ? 'success' : 'neutral'}>
                    {consultations.length > 0 ? `v${consultations[0].version} saved` : 'Not recorded'}
                  </Badge>
                </div>
              )}

              {/* Tabs */}
              <div className="tabs">
                {(['consultation', 'prescription', 'history'] as const).map(tab => (
                  <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {tab === 'history' && consultations.length > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius-full)', background: 'var(--brand-primary-10)', color: 'var(--brand-primary)' }}>
                        {consultations.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* ── Consultation form ── */}
              {activeTab === 'consultation' && (
                <div className="card" style={{ padding: 24 }}>
                  {consultError && <div style={{ marginBottom: 16 }}><Alert variant="error" onDismiss={() => setConsultError('')}>{consultError}</Alert></div>}

                  <form onSubmit={handleC(onSubmitConsultation)} noValidate>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div>
                        <label className="form-label">Chief complaint *</label>
                        <textarea className="form-textarea" {...regC('chiefComplaint')} rows={2} placeholder="Patient's main concern…" style={{ minHeight: 72 }} />
                        {errC.chiefComplaint && <p className="form-error">{errC.chiefComplaint.message}</p>}
                      </div>
                      <div>
                        <label className="form-label">Vitals</label>
                        <input className="form-input" {...regC('vitals')} placeholder="BP, Temp, SpO2, Pulse…" />
                      </div>
                      <div>
                        <label className="form-label">Clinical observations</label>
                        <textarea className="form-textarea" {...regC('observations')} rows={3} placeholder="Examination findings…" />
                      </div>
                      <div>
                        <label className="form-label">Diagnosis *</label>
                        <textarea className="form-textarea" {...regC('diagnosis')} rows={2} placeholder="Primary diagnosis…" style={{ minHeight: 72 }} />
                        {errC.diagnosis && <p className="form-error">{errC.diagnosis.message}</p>}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="submit" className="btn btn-primary" disabled={isSubC}>
                          {isSubC && <span className="spinner spinner-sm" />}
                          {isSubC ? 'Saving…' : 'Save consultation note →'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* ── Prescription form ── */}
              {activeTab === 'prescription' && (
                <div className="card" style={{ padding: 24 }}>
                  <form onSubmit={handleP(onSubmitPrescription)} noValidate>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Prescriptions</h3>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ medicine: '', dosage: '', frequency: '', duration: '' })}>
                        + Add medicine
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {fields.map((field, i) => (
                        <div key={field.id} style={{ padding: 14, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-hover)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label className="form-label">Medicine *</label>
                              <input className="form-input" {...regP(`items.${i}.medicine`)} placeholder="Drug name + strength" />
                            </div>
                            <div>
                              <label className="form-label">Dosage *</label>
                              <input className="form-input" {...regP(`items.${i}.dosage`)} placeholder="1 tablet" />
                            </div>
                            <div>
                              <label className="form-label">Frequency *</label>
                              <input className="form-input" {...regP(`items.${i}.frequency`)} placeholder="Twice daily" />
                            </div>
                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <label className="form-label">Duration *</label>
                                <input className="form-input" {...regP(`items.${i}.duration`)} placeholder="5 days" />
                              </div>
                              {fields.length > 1 && (
                                <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(i)} aria-label="Remove" style={{ marginTop: 20, color: 'var(--color-danger-text)' }}>
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                      <button type="submit" className="btn btn-primary" disabled={isSubP}>
                        {isSubP && <span className="spinner spinner-sm" />}
                        {isSubP ? 'Saving…' : 'Save prescription →'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ── History ── */}
              {activeTab === 'history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {consultations.length === 0 ? (
                    <div className="card"><EmptyState icon={<NoteIcon />} title="No consultation records" description="Save a consultation note first." /></div>
                  ) : (
                    consultations.map(c => (
                      <div key={c.id} className="card" style={{ padding: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)' }}>
                              Version {c.version}
                            </span>
                            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 1 }}>{fmtDate(c.createdAt)}</div>
                          </div>
                          {c.previousVersionId && <Badge variant="info">Amended</Badge>}
                        </div>

                        <dl style={{ display: 'grid', gap: 10 }}>
                          {[
                            { label: 'Chief complaint', value: c.chiefComplaint },
                            { label: 'Observations', value: c.observations || '—' },
                            { label: 'Diagnosis', value: c.diagnosis },
                          ].map(f => (
                            <div key={f.label}>
                              <dt style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{f.label}</dt>
                              <dd style={{ fontSize: 13.5, color: 'var(--color-text)', marginTop: 3 }}>{f.value}</dd>
                            </div>
                          ))}
                        </dl>

                        {c.prescriptions && c.prescriptions.length > 0 && (
                          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-border-subtle)' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                              Prescriptions ({c.prescriptions.length})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {c.prescriptions.map((rx: any, i: number) => (
                                <div key={i} style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <strong style={{ color: 'var(--color-text)' }}>{rx.medicine}</strong>
                                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                                  <span>{rx.dosage} · {rx.frequency} · {rx.duration}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function NoteIcon() {
  return (
    <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}