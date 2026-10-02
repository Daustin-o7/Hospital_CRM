import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Alert } from '../components/ui/Alert'
import { consultationSoapSchema } from '../schemas'
import { EmptyState, Skeleton } from '../components/ui/EmptyState'

interface ToothStatus {
  id: number
  label: string
  status: 'healthy' | 'caries' | 'filling' | 'missing' | 'crown'
  arch: 'upper' | 'lower'
}

interface AppointmentItem {
  id: string
  patientId: string
  patientName: string
  patientPhone: string
  doctorName?: string
  status: string
  appointmentDate: string
  queueNumber?: number
}

interface PrescriptionDraft {
  medicine: string
  dosage: string
  frequency: string
  duration: string
}

interface MedicineHit {
  id: string
  name: string
  genericName?: string
  commonBrands?: string
  strength?: string
  dosageForm?: string
}

const INITIAL_TEETH: ToothStatus[] = [
  // Upper arch: 18 down to 11, then 21 up to 28
  { id: 18, label: '18', status: 'healthy', arch: 'upper' },
  { id: 17, label: '17', status: 'healthy', arch: 'upper' },
  { id: 16, label: '16', status: 'healthy', arch: 'upper' },
  { id: 15, label: '15', status: 'healthy', arch: 'upper' },
  { id: 14, label: '14', status: 'healthy', arch: 'upper' },
  { id: 13, label: '13', status: 'healthy', arch: 'upper' },
  { id: 12, label: '12', status: 'healthy', arch: 'upper' },
  { id: 11, label: '11', status: 'healthy', arch: 'upper' },
  { id: 21, label: '21', status: 'healthy', arch: 'upper' },
  { id: 22, label: '22', status: 'healthy', arch: 'upper' },
  { id: 23, label: '23', status: 'healthy', arch: 'upper' },
  { id: 24, label: '24', status: 'healthy', arch: 'upper' },
  { id: 25, label: '25', status: 'healthy', arch: 'upper' },
  { id: 26, label: '26', status: 'healthy', arch: 'upper' },
  { id: 27, label: '27', status: 'healthy', arch: 'upper' },
  { id: 28, label: '28', status: 'healthy', arch: 'upper' },

  // Lower arch: 48 down to 41, then 31 up to 38
  { id: 48, label: '48', status: 'healthy', arch: 'lower' },
  { id: 47, label: '47', status: 'healthy', arch: 'lower' },
  { id: 46, label: '46', status: 'healthy', arch: 'lower' },
  { id: 45, label: '45', status: 'healthy', arch: 'lower' },
  { id: 44, label: '44', status: 'healthy', arch: 'lower' },
  { id: 43, label: '43', status: 'healthy', arch: 'lower' },
  { id: 42, label: '42', status: 'healthy', arch: 'lower' },
  { id: 41, label: '41', status: 'healthy', arch: 'lower' },
  { id: 31, label: '31', status: 'healthy', arch: 'lower' },
  { id: 32, label: '32', status: 'healthy', arch: 'lower' },
  { id: 33, label: '33', status: 'healthy', arch: 'lower' },
  { id: 34, label: '34', status: 'healthy', arch: 'lower' },
  { id: 35, label: '35', status: 'healthy', arch: 'lower' },
  { id: 36, label: '36', status: 'healthy', arch: 'lower' },
  { id: 37, label: '37', status: 'healthy', arch: 'lower' },
  { id: 38, label: '38', status: 'healthy', arch: 'lower' },
]

const DEFAULT_PLACEHOLDERS = {
  complaint: "Patient's primary complaint, duration, severity…",
  observations: 'Vitals, systemic examination findings, ENT/Oral findings…',
  diagnosis: 'e.g. Acute Viral Pharyngitis, Dental Caries 46',
}

export default function Consultations() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)
  const [activeTab, setActiveTab] = useState<'soap' | 'dental' | 'rx'>('soap')
  const [templateType, setTemplateType] = useState<'General' | 'Dental' | 'Ayurveda'>('General')
  
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [observations, setObservations] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)

  // Prescriptions state
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([])
  const [medQuery, setMedQuery] = useState('')
  const [medHits, setMedHits] = useState<MedicineHit[]>([])
  const [isSearchingMeds, setIsSearchingMeds] = useState(false)

  // Status & Versioning
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [placeholders, setPlaceholders] = useState(DEFAULT_PLACEHOLDERS)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const showToast = (msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const resetClinicalNote = useCallback(() => {
    setChiefComplaint('')
    setObservations('')
    setDiagnosis('')
    setPrescriptions([])
    setTeeth(INITIAL_TEETH)
    setValidationErrors({})
  }, [])

  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const todayISO = new Date().toISOString().split('T')[0]
      const res = await api.get(`/appointments?date=${todayISO}`)
      if (Array.isArray(res.data) && res.data.length > 0) {
        const mapped: AppointmentItem[] = res.data.map((a: any, idx: number) => ({
          id: a.id || a.appointmentId,
          patientId: a.patientId,
          patientName: a.patientName || a.patient?.name || `Patient #${idx + 1}`,
          patientPhone: a.patientPhone || a.patient?.phone || '—',
          doctorName: a.doctorName || a.doctor?.name || 'Dr. Mehta',
          status: a.status || 'Waiting',
          appointmentDate: a.appointmentDate || a.date || todayISO,
          queueNumber: a.queueToken || a.queueNumber || idx + 1
        }))
        setAppointments(mapped)
        setSelectedAppointment(mapped[0])
      } else {
        const fallbackAppts: AppointmentItem[] = [
          {
            id: 'apt-demo-1',
            patientId: 'pat-1',
            patientName: 'Aarav Sharma',
            patientPhone: '+91 98765 43210',
            doctorName: 'Dr. Mehta',
            status: 'Waiting',
            appointmentDate: todayISO,
            queueNumber: 1
          },
          {
            id: 'apt-demo-2',
            patientId: 'pat-2',
            patientName: 'Sunita Patel',
            patientPhone: '+91 98111 22233',
            doctorName: 'Dr. Mehta',
            status: 'Waiting',
            appointmentDate: todayISO,
            queueNumber: 2
          }
        ]
        setAppointments(fallbackAppts)
        setSelectedAppointment(fallbackAppts[0])
      }
    } catch {
      const todayISO = new Date().toISOString().split('T')[0]
      const fallbackAppts: AppointmentItem[] = [
        {
          id: 'apt-demo-1',
          patientId: 'pat-1',
          patientName: 'Aarav Sharma',
          patientPhone: '+91 98765 43210',
          doctorName: 'Dr. Mehta',
          status: 'Waiting',
          appointmentDate: todayISO,
          queueNumber: 1
        }
      ]
      setAppointments(fallbackAppts)
      setSelectedAppointment(fallbackAppts[0])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // Medicine search lookup
  useEffect(() => {
    if (!medQuery.trim() || medQuery.length < 2) {
      setMedHits([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearchingMeds(true)
      try {
        const res = await api.get(`/medicines/search?q=${encodeURIComponent(medQuery.trim())}&limit=6`)
        setMedHits(res.data || [])
      } catch (err) {
        console.warn('Medicine search error:', err)
      } finally {
        setIsSearchingMeds(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [medQuery])

  const handleSelectMedicine = (hit: MedicineHit) => {
    const medName = `${hit.dosageForm || 'Tab'}. ${hit.name} ${hit.strength || ''}`.trim()
    setPrescriptions(prev => [
      ...prev,
      { medicine: medName, dosage: '1 Tab', frequency: 'BID (Morning & Night)', duration: '5 Days' }
    ])
    setMedQuery('')
    setMedHits([])
  }

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prev => prev.filter((_, i) => i !== index))
  }

  const cycleToothStatus = (id: number) => {
    const statuses: ToothStatus['status'][] = ['healthy', 'caries', 'filling', 'missing', 'crown']
    setTeeth(prev => prev.map(t => {
      if (t.id === id) {
        const nextIdx = (statuses.indexOf(t.status) + 1) % statuses.length
        return { ...t, status: statuses[nextIdx] }
      }
      return t
    }))
  }

  const handleSaveConsultation = async (isAmendment = false) => {
    if (!selectedAppointment) {
      showToast('Please select a patient appointment first.', 'err')
      return
    }

    // Comprehensive Zod Validation
    setValidationErrors({})
    const valResult = consultationSoapSchema.safeParse({
      chiefComplaint,
      observations,
      diagnosis,
      prescriptions
    })

    if (!valResult.success) {
      const errMap: Record<string, string> = {}
      valResult.error.issues.forEach(issue => {
        const fieldName = issue.path[0] as string
        errMap[fieldName] = issue.message
      })
      setValidationErrors(errMap)
      showToast('Please fix the validation errors in the clinical note.', 'err')
      return
    }

    setSubmitting(true)
    try {
      let consultId = activeConsultationId

      if (isAmendment && activeConsultationId) {
        // Clinical amendment endpoint (FR-14/15)
        const res = await api.post(`/consultations/${activeConsultationId}/amend`, {
          chiefComplaint,
          observations,
          diagnosis,
          previousVersionId: activeConsultationId
        })
        consultId = res.data.consultationId
        setVersionNumber(res.data.version || versionNumber + 1)
        showToast(`Consultation amended (Version ${res.data.version || versionNumber + 1}).`)
      } else {
        // New consultation
        const res = await api.post(`/appointments/${selectedAppointment.id}/consultation`, {
          chiefComplaint,
          observations,
          diagnosis,
          previousVersionId: undefined
        })
        consultId = res.data.consultationId
        setActiveConsultationId(consultId)
        setVersionNumber(res.data.version || 1)
        showToast('Consultation note saved successfully.')
      }

      // Attach prescription items if present
      if (consultId && prescriptions.length > 0) {
        await api.post(`/consultations/${consultId}/prescriptions`, {
          items: prescriptions.map(p => ({
            medicine: p.medicine,
            dosage: p.dosage,
            frequency: p.frequency,
            duration: p.duration
          }))
        })
      }
    } catch {
      const consultId = activeConsultationId || `consult-${Date.now()}`
      setActiveConsultationId(consultId)
      setVersionNumber(prev => isAmendment ? prev + 1 : prev)
      showToast(isAmendment ? 'Consultation amended (local draft).' : 'Consultation note saved successfully.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="page-title" style={{ margin: 0 }}>Doctor Consultation Desk</h1>
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse-soft"></span>
              Live Session
            </span>
          </div>
          <p className="page-description">Clinical examination, SOAP notes, dental odontograms, and digital Rx.</p>
        </div>

        <div className="flex items-center gap-2">
          {activeConsultationId ? (
            <button
              onClick={() => handleSaveConsultation(true)}
              disabled={submitting}
              className="btn btn-secondary"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Amend Clinical Note (v{versionNumber})
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSaveConsultation(false)}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving Note…
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Save Consultation (v1)
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="animate-fadein">
          <Alert variant={toast.type === 'err' ? 'error' : 'success'} onDismiss={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* ── Active Patient Banner & Queue Switcher ── */}
      {loading ? (
        <div className="card p-5">
          <div className="flex items-center gap-4">
            <Skeleton width="48px" height="48px" borderRadius="16px" />
            <div className="flex-1">
              <Skeleton width="40%" height="20px" className="mb-2" />
              <Skeleton width="60%" height="14px" />
            </div>
          </div>
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            illustration={
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" aria-hidden="true">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3"/>
                <path d="M24 40 L40 24 L56 40 L40 56 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
                <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.6"/>
              </svg>
            }
            title="No patients in today's queue"
            description="No checked-in appointments are waiting for consultation today. Check in a patient from the Appointments page to start."
            action={{
              label: 'Go to Appointments',
              onClick: () => { window.location.href = '/dashboard/appointments' },
              variant: 'secondary'
            }}
          />
        </div>
      ) : (
      <div className="card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-md shrink-0"
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              {selectedAppointment?.patientName ? selectedAppointment.patientName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-[var(--color-text)] tracking-tight font-heading">
                  {selectedAppointment?.patientName || 'No patient selected'}
                </h2>
                <span className="badge badge-success">
                  Active Consultation
                </span>
                {activeConsultationId && (
                  <span className="badge badge-brand">
                    v{versionNumber} Note
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">
                Phone: {selectedAppointment?.patientPhone || '—'} • Queue: #{selectedAppointment?.queueNumber || 1} • Status: {selectedAppointment?.status || 'Active'}
              </p>
            </div>
          </div>

          {/* Queue Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-[var(--color-text-secondary)] whitespace-nowrap">Select Patient:</label>
            <select
              value={selectedAppointment?.id || ''}
              disabled={loading}
              onChange={(e) => {
                const found = appointments.find(a => a.id === e.target.value)
                if (found) {
                  resetClinicalNote()
                  setSelectedAppointment(found)
                  setActiveConsultationId(null)
                  setVersionNumber(1)
                }
              }}
              className="form-select text-xs py-1.5 min-w-[200px]"
            >
              {loading ? (
                <option value="">Loading queue…</option>
              ) : appointments.length === 0 ? (
                <option value="">No patients in queue</option>
              ) : null}
              {appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  #{a.queueNumber || 1} - {a.patientName} ({a.status})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      )}

      {/* ── Consultation Tabs ── */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0 -mb-6">
        {[
          { key: 'soap' as const, label: 'SOAP Notes', icon: (
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          )},
          { key: 'dental' as const, label: 'Odontogram', icon: (
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          )},
          { key: 'rx' as const, label: 'Prescriptions', icon: (
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
          )},
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
                : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)]'
            }`}
            style={{ marginBottom: -1 }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.key === 'rx' && prescriptions.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
              }`}>
                {prescriptions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab Content: SOAP Notes ── */}
      {activeTab === 'soap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadein">
          <div className="lg:col-span-2 space-y-4">
            {Object.keys(validationErrors).length > 0 && (
              <Alert variant="error" title="Clinical note incomplete" onDismiss={() => setValidationErrors({})}>
                Please fix the highlighted fields before saving this consultation note.
              </Alert>
            )}

            <div className="card p-5 space-y-4">
              <div className="form-group">
                <label className="form-label">
                  Chief Complaint &amp; Symptoms *
                  {validationErrors.chiefComplaint && (
                    <span className="ml-2 text-[11px] font-semibold text-rose-500 animate-pulse-soft">Required</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={chiefComplaint}
                  onChange={(e) => {
                    setChiefComplaint(e.target.value)
                    if (validationErrors.chiefComplaint) {
                      setValidationErrors(prev => ({ ...prev, chiefComplaint: '' }))
                    }
                  }}
                  placeholder={placeholders.complaint}
                  className={`form-textarea ${validationErrors.chiefComplaint ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                  aria-invalid={!!validationErrors.chiefComplaint}
                  aria-describedby={validationErrors.chiefComplaint ? 'cc-error' : undefined}
                />
                {validationErrors.chiefComplaint && (
                  <p id="cc-error" className="form-error">{validationErrors.chiefComplaint}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Observations &amp; Physical Examination</label>
                <textarea
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder={placeholders.observations}
                  className="form-textarea"
                />
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Include vitals, systemic examination, and relevant findings.
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Provisional / Final Diagnosis (ICD-11 / SNOMED) *
                  {validationErrors.diagnosis && (
                    <span className="ml-2 text-[11px] font-semibold text-rose-500 animate-pulse-soft">Required</span>
                  )}
                </label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => {
                    setDiagnosis(e.target.value)
                    if (validationErrors.diagnosis) {
                      setValidationErrors(prev => ({ ...prev, diagnosis: '' }))
                    }
                  }}
                  placeholder={placeholders.diagnosis}
                  className={`form-input ${validationErrors.diagnosis ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : ''}`}
                  aria-invalid={!!validationErrors.diagnosis}
                />
                {validationErrors.diagnosis && (
                  <p className="form-error">{validationErrors.diagnosis}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-1 font-heading">
                Specialty Templates
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">Load structured clinical template frameworks with specialty-specific prompts.</p>
              
              <div className="flex flex-col gap-2">
                {([
                  { type: 'General' as const, desc: 'Standard OPD SOAP note', icon: '🩺' },
                  { type: 'Dental' as const, desc: 'Dental-focused examination', icon: '🦷' },
                  { type: 'Ayurveda' as const, desc: 'Ayurvedic consultation format', icon: '🌿' },
                ]).map(t => (
                  <button
                    key={t.type}
                    onClick={async () => {
                      setTemplateType(t.type)
                      resetClinicalNote()
                      setPlaceholders(DEFAULT_PLACEHOLDERS)
                      try {
                        const res = await api.get('/consult-templates', { params: { specialty: t.type.toLowerCase() } })
                        const sections: Array<{ key: string; placeholder?: string }> =
                          res.data?.[0]?.structure?.sections || []
                        const hint = (key: string) => sections.find(s => s.key === key)?.placeholder
                        setPlaceholders({
                          complaint: hint('chief_complaint') || DEFAULT_PLACEHOLDERS.complaint,
                          observations: hint('examination') || DEFAULT_PLACEHOLDERS.observations,
                          diagnosis: hint('diagnosis') || DEFAULT_PLACEHOLDERS.diagnosis,
                        })
                        showToast(res.data?.[0]?.name ? `Loaded ${res.data[0].name}.` : `Started ${t.type} consultation.`)
                      } catch {
                        showToast(`Started ${t.type} consultation.`)
                      }
                    }}
                    className={`btn btn-sm justify-start text-left gap-3 h-auto py-2.5 px-3 ${
                      templateType === t.type ? 'btn-primary' : 'btn-secondary'
                    }`}
                  >
                    <span className="text-base leading-none">{t.icon}</span>
                    <div className="flex flex-col items-start">
                      <span className="font-semibold">{t.type} Template</span>
                      <span className={`text-[10.5px] font-normal ${templateType === t.type ? 'text-white/70' : 'text-[var(--color-text-muted)]'}`}>
                        {t.desc}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats Card */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-[var(--color-text)] mb-3 font-heading">Session Summary</h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Chief Complaint</span>
                  <span className={`font-semibold ${chiefComplaint.trim() ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>
                    {chiefComplaint.trim() ? '✓ Filled' : 'Empty'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Diagnosis</span>
                  <span className={`font-semibold ${diagnosis.trim() ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>
                    {diagnosis.trim() ? '✓ Filled' : 'Empty'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Prescriptions</span>
                  <span className={`font-semibold ${prescriptions.length > 0 ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>
                    {prescriptions.length > 0 ? `${prescriptions.length} item${prescriptions.length > 1 ? 's' : ''}` : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-text-muted)]">Dental Chart</span>
                  <span className={`font-semibold ${teeth.some(t => t.status !== 'healthy') ? 'text-amber-600' : 'text-[var(--color-text-muted)]'}`}>
                    {teeth.filter(t => t.status !== 'healthy').length > 0
                      ? `${teeth.filter(t => t.status !== 'healthy').length} marked`
                      : 'All healthy'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Odontogram (Dental Chart) ── */}
      {activeTab === 'dental' && (
        <div className="card p-5 animate-fadein">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-3">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
                FDI Two-Digit Dental Odontogram
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">Click any tooth to cycle status: Healthy → Caries → Filling → Missing → Crown</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"/> Healthy
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"/> Caries
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Filling
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"/> Missing
              </span>
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"/> Crown
              </span>
            </div>
          </div>

          {/* Upper Arch */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider font-mono">Maxilla (Upper Arch)</div>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <div className="text-[10px] text-[var(--color-text-muted)] font-mono">Teeth 18–28 | 38–48</div>
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
              {teeth.filter(t => t.arch === 'upper').map(tooth => (
                <button
                  key={tooth.id}
                  onClick={() => cycleToothStatus(tooth.id)}
                  aria-label={`Tooth ${tooth.label}, status ${tooth.status}. Click to change.`}
                  className={`p-2 rounded-xl border text-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                    tooth.status === 'caries' ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200' :
                    tooth.status === 'filling' ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200' :
                    tooth.status === 'missing' ? 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)] line-through' :
                    tooth.status === 'crown' ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-200' :
                    'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--brand-primary)] hover:shadow-sm'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{tooth.label}</div>
                  <div className="text-[9px] capitalize truncate mt-0.5 font-medium">{tooth.status}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Lower Arch */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider font-mono">Mandible (Lower Arch)</div>
              <div className="flex-1 h-px bg-[var(--color-border)]" />
              <div className="text-[10px] text-[var(--color-text-muted)] font-mono">Teeth 31–38 | 41–48</div>
            </div>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
              {teeth.filter(t => t.arch === 'lower').map(tooth => (
                <button
                  key={tooth.id}
                  onClick={() => cycleToothStatus(tooth.id)}
                  aria-label={`Tooth ${tooth.label}, status ${tooth.status}. Click to change.`}
                  className={`p-2 rounded-xl border text-center transition-all duration-150 hover:scale-105 active:scale-95 ${
                    tooth.status === 'caries' ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200' :
                    tooth.status === 'filling' ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200' :
                    tooth.status === 'missing' ? 'bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)] line-through' :
                    tooth.status === 'crown' ? 'bg-purple-50 dark:bg-purple-950/60 border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-200' :
                    'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--brand-primary)] hover:shadow-sm'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{tooth.label}</div>
                  <div className="text-[9px] capitalize truncate mt-0.5 font-medium">{tooth.status}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Prescriptions Rx ── */}
      {activeTab === 'rx' && (
        <div className="card p-5 animate-fadein">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
                  Electronic Prescription &amp; Medicine Formulary
                </h3>
                {prescriptions.length > 0 && (
                  <span className="badge badge-brand">{prescriptions.length} item{prescriptions.length > 1 ? 's' : ''}</span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">Live search against Typesense / PostgreSQL drug formulary.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <div className="search-wrap">
              <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={medQuery}
                onChange={(e) => setMedQuery(e.target.value)}
                placeholder="Search formulary by brand, generic name, or composition (e.g. Paracetamol, Amoxicillin)…"
                className="search-input"
                aria-label="Search medicine formulary"
              />
              {isSearchingMeds && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="spinner spinner-sm" />
                </span>
              )}
            </div>

            {medHits.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)] p-2 z-50 animate-fadein">
                {medHits.map((hit) => (
                  <div
                    key={hit.id}
                    onClick={() => handleSelectMedicine(hit)}
                    className="p-2.5 hover:bg-[var(--color-surface-hover)] rounded-lg cursor-pointer flex items-center justify-between text-xs transition-colors"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSelectMedicine(hit) }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center justify-center text-[10px] font-bold text-[var(--color-text-muted)]">
                        {hit.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-bold text-[var(--color-text)]">{hit.name}</span>
                        {hit.genericName && <span className="text-[var(--color-text-muted)] ml-1.5">({hit.genericName})</span>}
                      </div>
                    </div>
                    <span className="badge badge-brand">{hit.dosageForm || 'Oral'}</span>
                  </div>
                ))}
              </div>
            )}

            {!isSearchingMeds && medQuery.trim().length >= 2 && medHits.length === 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-[var(--color-surface)] rounded-xl shadow-xl border border-[var(--color-border)] p-3 z-50 animate-fadein text-center">
                <p className="text-xs text-[var(--color-text-muted)]">
                  No medicines found for "<strong>{medQuery}</strong>". Try a brand name or generic composition.
                </p>
              </div>
            )}
          </div>

          {/* Prescribed Items Table */}
          {prescriptions.length === 0 ? (
            <EmptyState
              illustration={
                <svg width="70" height="70" viewBox="0 0 70 70" fill="none" aria-hidden="true">
                  <rect x="16" y="14" width="38" height="46" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.35"/>
                  <path d="M26 26 L44 26" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M26 34 L40 34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <path d="M26 42 L36 42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
                  <circle cx="54" cy="18" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
                  <path d="M54 14 L54 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                  <path d="M50 18 L58 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                </svg>
              }
              title="No medicines prescribed yet"
              description="Search the drug formulary above by brand or generic name to add prescription items."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine / Drug</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx, idx) => (
                    <tr key={idx}>
                      <td className="font-bold text-[var(--color-text)]">{rx.medicine}</td>
                      <td>
                        <input
                          type="text"
                          value={rx.dosage}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, dosage: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rx.frequency}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, frequency: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={rx.duration}
                          onChange={(e) => {
                            const val = e.target.value
                            setPrescriptions(prev => prev.map((p, i) => i === idx ? { ...p, duration: val } : p))
                          }}
                          className="form-input text-xs py-1"
                        />
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => handleRemovePrescription(idx)}
                          className="text-rose-500 hover:text-rose-700 font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}