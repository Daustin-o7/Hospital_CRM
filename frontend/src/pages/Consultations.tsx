import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'
import { consultationSoapSchema } from '../schemas'
import {
  FileTextIcon,
  CheckIcon,
  PillIcon,
  ActivityIcon
} from '../components/icons/Index'
import {
  SPECIALTIES,
  INITIAL_TEETH
} from '../components/consultations/consultationTypes'
import type {
  SpecialtyId,
  ToothStatus,
  AppointmentItem,
  PatientDetails,
  PrescriptionDraft
} from '../components/consultations/consultationTypes'
import PatientCommandRibbon from '../components/consultations/PatientCommandRibbon'
import ClinicalSoapEditor from '../components/consultations/ClinicalSoapEditor'
import SpecialtyToolsPanel from '../components/consultations/SpecialtyToolsPanel'
import PrescriptionsEditor from '../components/consultations/PrescriptionsEditor'

// Development-only demo queue. The literal is the true branch of a condition that
// compiles to `false` in production, so the bundler drops it and its values entirely.
const DEMO_APPOINTMENTS: AppointmentItem[] = import.meta.env.DEV
  ? [
      {
        id: 'apt-demo-1',
        patientId: 'pat-1',
        patientName: 'Pooja Sharma 5603',
        patientPhone: '+91 98765 43210',
        patientGender: 'Female',
        patientAge: 28,
        doctorName: 'Dr. Practitioner',
        status: 'Booked',
        appointmentDate: new Date().toISOString().split('T')[0],
        queueNumber: 1,
        priority: 'Normal',
        type: 'Scheduled'
      },
      {
        id: 'apt-demo-2',
        patientId: 'pat-2',
        patientName: 'Aarav Verma',
        patientPhone: '+91 98111 22233',
        patientGender: 'Male',
        patientAge: 35,
        doctorName: 'Dr. Practitioner',
        status: 'Waiting',
        appointmentDate: new Date().toISOString().split('T')[0],
        queueNumber: 2,
        priority: 'Normal',
        type: 'Walk-In'
      }
    ]
  : []

export default function Consultations() {
  const [searchParams] = useSearchParams()
  const querySpecialty = searchParams.get('specialty') as SpecialtyId | null
  const queryPatientId = searchParams.get('patientId')
  const queryAppointmentId = searchParams.get('appointmentId')

  // ── Doctor Specialization ──
  const [selectedSpecialty, setSelectedSpecialty] = useState<SpecialtyId>(() => {
    if (querySpecialty && SPECIALTIES.some(s => s.id === querySpecialty)) {
      return querySpecialty
    }
    const saved = localStorage.getItem('hospital_crm_doctor_specialty')
    return (saved as SpecialtyId) || 'general'
  })

  // ── Appointment Queue ──
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Workspace Tabs ──
  const [activeTab, setActiveTab] = useState<'soap' | 'tools' | 'rx' | 'template_structure'>('soap')

  // ── Clinical SOAP Notes ──
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [observations, setObservations] = useState('')
  const [diagnosis, setDiagnosis] = useState('')

  // ── Dynamic Template Structure from Backend ──
  const [templateSections, setTemplateSections] = useState<Array<{ key: string; label: string; placeholder?: string }>>([])
  const [templateName, setTemplateName] = useState<string>('')

  // ── Shared Odontogram State ──
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)

  // ── Prescriptions State ──
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([])

  // ── Status, Versioning, Validation ──
  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  // Refs for smooth autofocus
  const complaintInputRef = useRef<HTMLTextAreaElement>(null)
  const diagnosisInputRef = useRef<HTMLInputElement>(null)

  const currentSpecialtyConfig = useMemo(() => {
    return SPECIALTIES.find(s => s.id === selectedSpecialty) || SPECIALTIES[0]
  }, [selectedSpecialty])

  const showToast = useCallback((msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Fetch Appointments Queue ──
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
          patientPhone: a.patientPhone || a.patient?.phone || '+91 98765 43210',
          patientGender: a.patientGender || a.patient?.gender || 'Unknown',
          patientAge: a.patientAge ?? a.patient?.approxAge ?? 30,
          patientDob: a.patientDob || a.patient?.dob,
          doctorName: a.doctorName || a.doctor?.name || 'Dr. Practitioner',
          status: a.status || 'Waiting',
          appointmentDate: a.appointmentDate || a.date || todayISO,
          queueNumber: a.queueToken || a.queueNumber || idx + 1,
          priority: a.priority || 'Normal',
          type: a.type || 'Scheduled'
        }))
        setAppointments(mapped)
        const match = queryAppointmentId ? mapped.find(m => m.id === queryAppointmentId) : null
        const pMatch = queryPatientId ? mapped.find(m => m.patientId === queryPatientId) : null
        setSelectedAppointment(match || pMatch || mapped[0])
      } else {
        setAppointments(DEMO_APPOINTMENTS)
        const match = queryAppointmentId ? DEMO_APPOINTMENTS.find(m => m.id === queryAppointmentId) : null
        const pMatch = queryPatientId ? DEMO_APPOINTMENTS.find(m => m.patientId === queryPatientId) : null
        setSelectedAppointment(match || pMatch || DEMO_APPOINTMENTS[0] || null)
      }
    } catch {
      setAppointments(DEMO_APPOINTMENTS.slice(0, 1))
      setSelectedAppointment(DEMO_APPOINTMENTS[0] || null)
    } finally {
      setLoading(false)
    }
  }, [queryAppointmentId, queryPatientId])

  useEffect(() => {
    fetchAppointments()
  }, [fetchAppointments])

  // ── Fetch Full Patient Demographics When Selected ──
  useEffect(() => {
    if (!selectedAppointment?.patientId) return

    let isMounted = true
    // The DEV demo queue carries placeholder ids; those rows use the appointment data.
    const fallbackDetails: PatientDetails = {
      id: selectedAppointment.patientId,
      name: selectedAppointment.patientName,
      phone: selectedAppointment.patientPhone && selectedAppointment.patientPhone !== '—'
        ? selectedAppointment.patientPhone
        : '+91 98765 43210',
      gender: selectedAppointment.patientGender || 'Female',
      approxAge: selectedAppointment.patientAge || 28,
      bloodGroup: 'B+',
      allergies: 'NKDA (No known drug allergies)'
    }

    const loadPatientDetails = async () => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAppointment.patientId)) {
        if (isMounted) setPatientDetails(fallbackDetails)
        return
      }

      try {
        const res = await api.get(`/patients/${selectedAppointment.patientId}`)
        if (isMounted && res.data) {
          setPatientDetails({
            id: res.data.id || selectedAppointment.patientId,
            name: res.data.name || selectedAppointment.patientName,
            phone: res.data.phone || selectedAppointment.patientPhone || '+91 98765 43210',
            gender: res.data.gender || selectedAppointment.patientGender || 'Unspecified',
            approxAge: res.data.approxAge ?? selectedAppointment.patientAge ?? 30,
            dob: res.data.dob || selectedAppointment.patientDob,
            bloodGroup: res.data.bloodGroup || 'O+',
            allergies: res.data.allergies || 'NKDA (No known drug allergies)'
          })
        }
      } catch {
        if (isMounted) {
          setPatientDetails(fallbackDetails)
        }
      }
    }

    loadPatientDetails()
    return () => { isMounted = false }
  }, [selectedAppointment])

  // ── Auto-save Draft to LocalStorage ──
  useEffect(() => {
    if (!selectedAppointment?.id) return
    const key = `hospital_crm_draft_${selectedAppointment.id}`

    const saved = localStorage.getItem(key)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.chiefComplaint && !chiefComplaint) setChiefComplaint(parsed.chiefComplaint)
        if (parsed.observations && !observations) setObservations(parsed.observations)
        if (parsed.diagnosis && !diagnosis) setDiagnosis(parsed.diagnosis)
        if (parsed.prescriptions && prescriptions.length === 0) setPrescriptions(parsed.prescriptions)
      } catch {
        // Ignore JSON error
      }
    }
  }, [selectedAppointment?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedAppointment?.id) return
    if (!chiefComplaint && !observations && !diagnosis) return

    const key = `hospital_crm_draft_${selectedAppointment.id}`
    const timer = setTimeout(() => {
      localStorage.setItem(key, JSON.stringify({
        chiefComplaint,
        observations,
        diagnosis,
        prescriptions,
        savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 800)

    return () => clearTimeout(timer)
  }, [chiefComplaint, observations, diagnosis, prescriptions, selectedAppointment?.id])

  // ── Fetch Specialty Templates from Backend ──
  const fetchTemplateForSpecialty = useCallback(async (spec: SpecialtyId) => {
    try {
      const res = await api.get('/consult-templates', { params: { specialty: spec } })
      if (Array.isArray(res.data) && res.data.length > 0) {
        const tpl = res.data[0]
        setTemplateName(tpl.name || '')
        const sections = tpl.structure?.sections || []
        setTemplateSections(sections)
      }
    } catch {
      // Backend fallback handled seamlessly
    }
  }, [])

  useEffect(() => {
    fetchTemplateForSpecialty(selectedSpecialty)
  }, [selectedSpecialty, fetchTemplateForSpecialty])

  // ── Switch Specialty without losing typed clinical notes ──
  const handleSelectSpecialty = useCallback((spec: SpecialtyId) => {
    setSelectedSpecialty(spec)
    localStorage.setItem('hospital_crm_doctor_specialty', spec)
    const cfg = SPECIALTIES.find(s => s.id === spec)
    showToast(`Switched consultation context to ${cfg?.name || spec}. Existing notes preserved.`)
  }, [showToast])

  // ── Save Consultation (FR-14 & FR-15) ──
  const handleSaveConsultation = useCallback(async (isAmendment = false) => {
    if (!selectedAppointment) {
      showToast('Please select a patient appointment first.', 'err')
      return
    }

    const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAppointment.id)

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

      if (errMap.chiefComplaint && complaintInputRef.current) {
        complaintInputRef.current.focus()
      } else if (errMap.diagnosis && diagnosisInputRef.current) {
        diagnosisInputRef.current.focus()
      }

      showToast('Please provide both Chief Complaint and Diagnosis before saving.', 'err')
      return
    }

    if (!isGuid) {
      showToast('Demo appointment saved in local session. Connect backend for cloud persistence.')
      setVersionNumber(v => v + 1)
      return
    }

    setSubmitting(true)
    try {
      let consultId = activeConsultationId

      if (isAmendment && activeConsultationId) {
        const res = await api.post(`/consultations/${activeConsultationId}/amend`, {
          chiefComplaint,
          observations,
          diagnosis,
          previousVersionId: activeConsultationId
        })
        consultId = res.data.consultationId
        setVersionNumber(res.data.version || versionNumber + 1)
        showToast(`Consultation amended successfully (Version ${res.data.version || versionNumber + 1}).`)
      } else {
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

      localStorage.removeItem(`hospital_crm_draft_${selectedAppointment.id}`)
      setDraftSavedAt(null)
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.response?.data?.message || friendlyError(err) || 'Failed to save consultation.'
      showToast(msg, 'err')
    } finally {
      setSubmitting(false)
    }
  }, [selectedAppointment, chiefComplaint, observations, diagnosis, prescriptions, activeConsultationId, versionNumber, showToast])

  // ── Keyboard Shortcuts (Ctrl+S, Alt+1/2/3/4) ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        handleSaveConsultation(!!activeConsultationId)
      } else if (e.altKey && e.key === '1') {
        e.preventDefault()
        setActiveTab('soap')
      } else if (e.altKey && e.key === '2') {
        e.preventDefault()
        setActiveTab('tools')
      } else if (e.altKey && e.key === '3') {
        e.preventDefault()
        setActiveTab('rx')
      } else if (e.altKey && e.key === '4') {
        e.preventDefault()
        setActiveTab('template_structure')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSaveConsultation, activeConsultationId])

  // ── Queue Navigation ──
  const currentQueueIndex = useMemo(() => {
    if (!selectedAppointment) return -1
    return appointments.findIndex(a => a.id === selectedAppointment.id)
  }, [appointments, selectedAppointment])

  const handlePrevPatient = useCallback(() => {
    if (currentQueueIndex > 0) {
      setSelectedAppointment(appointments[currentQueueIndex - 1])
      setActiveConsultationId(null)
      setVersionNumber(1)
    }
  }, [appointments, currentQueueIndex])

  const handleNextPatient = useCallback(() => {
    if (currentQueueIndex >= 0 && currentQueueIndex < appointments.length - 1) {
      setSelectedAppointment(appointments[currentQueueIndex + 1])
      setActiveConsultationId(null)
      setVersionNumber(1)
    }
  }, [appointments, currentQueueIndex])

  const handleInsertFindingsFromTools = useCallback((snippet: string, toastMsg: string) => {
    setObservations(prev => (prev ? `${prev}\n\n${snippet}` : snippet))
    setActiveTab('soap')
    showToast(toastMsg)
  }, [showToast])

  return (
    <div className="space-y-4 pb-16 animate-fadein">
      {/* ── 1. UNIFIED CLINICAL DESK HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[var(--color-border)] shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center text-base shadow-xs">
              {currentSpecialtyConfig.icon}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight font-heading leading-tight m-0">
                  Doctor Clinical Desk
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-soft" />
                  Live Consultation
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                EMR note codification, specialty diagnostic charts, and e-Prescriptions
              </p>
            </div>
          </div>
        </div>

        {/* Right Header Toolbar: Specialty Switcher & Save Action */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider font-mono">Discipline:</span>
            <select
              value={selectedSpecialty}
              onChange={(e) => handleSelectSpecialty(e.target.value as SpecialtyId)}
              className="bg-transparent text-xs font-bold text-slate-800 border-none outline-none cursor-pointer pr-1"
              aria-label="Select Doctor Specialty"
            >
              {SPECIALTIES.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          {draftSavedAt && (
            <span className="text-[11px] text-slate-500 hidden xl:inline font-mono">
              Auto-saved {draftSavedAt}
            </span>
          )}

          {/* Save / Amend Button */}
          {activeConsultationId ? (
            <button
              onClick={() => handleSaveConsultation(true)}
              disabled={submitting}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              title="Amend note (Ctrl+S)"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving…
                </>
              ) : (
                <>
                  <FileTextIcon />
                  <span>Amend Note (v{versionNumber})</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handleSaveConsultation(false)}
              disabled={submitting}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
              title="Save consultation (Ctrl+S)"
            >
              {submitting ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving Note…
                </>
              ) : (
                <>
                  <CheckIcon />
                  <span>Save Consultation (v1)</span>
                  <span className="text-[10px] opacity-80 font-mono hidden sm:inline ml-1 bg-black/15 px-1.5 py-0.2 rounded">Ctrl+S</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {toast && (
        <div className="animate-fadein">
          <Alert variant={toast.type === 'err' ? 'error' : 'success'} onDismiss={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* ── 2. ACTIVE PATIENT COMMAND RIBBON ── */}
      <PatientCommandRibbon
        loading={loading}
        appointments={appointments}
        selectedAppointment={selectedAppointment}
        patientDetails={patientDetails}
        currentQueueIndex={currentQueueIndex}
        onSelectAppointment={(found) => {
          setSelectedAppointment(found)
          setActiveConsultationId(null)
          setVersionNumber(1)
        }}
        onPrevPatient={handlePrevPatient}
        onNextPatient={handleNextPatient}
        showToast={showToast}
      />

      {/* ── 3. WORKSPACE NAVIGATION TABS ── */}
      <div className="flex items-center gap-1 border-b border-[var(--color-border)] pb-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab('soap')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'soap'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <FileTextIcon />
          <span>SOAP Clinical Note</span>
        </button>

        <button
          onClick={() => setActiveTab('tools')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'tools'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <span>{currentSpecialtyConfig.toolTabIcon}</span>
          <span>{currentSpecialtyConfig.toolTabName}</span>
        </button>

        <button
          onClick={() => setActiveTab('rx')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'rx'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <PillIcon />
          <span>Prescriptions Rx</span>
          {prescriptions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'rx' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
            }`}>
              {prescriptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('template_structure')}
          className={`btn btn-sm relative rounded-b-none border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'template_structure'
              ? 'btn-primary border-b-[var(--brand-primary)] shadow-none'
              : 'btn-ghost border-b-transparent hover:border-b-[var(--color-border)] text-slate-600'
          }`}
          style={{ marginBottom: -1 }}
        >
          <ActivityIcon />
          <span>Template Sections</span>
        </button>
      </div>

      {/* ── TAB 1: SOAP CLINICAL NOTE ── */}
      {activeTab === 'soap' && (
        <ClinicalSoapEditor
          chiefComplaint={chiefComplaint}
          setChiefComplaint={setChiefComplaint}
          observations={observations}
          setObservations={setObservations}
          diagnosis={diagnosis}
          setDiagnosis={setDiagnosis}
          validationErrors={validationErrors}
          setValidationErrors={setValidationErrors}
          currentSpecialtyConfig={currentSpecialtyConfig}
          selectedSpecialty={selectedSpecialty}
          prescriptionsCount={prescriptions.length}
          teeth={teeth}
          complaintInputRef={complaintInputRef}
          diagnosisInputRef={diagnosisInputRef}
          onSwitchTab={setActiveTab}
        />
      )}

      {/* ── TAB 2: SPECIALIZED CLINICAL TOOLS ── */}
      {activeTab === 'tools' && (
        <SpecialtyToolsPanel
          selectedSpecialty={selectedSpecialty}
          onInsertFindings={handleInsertFindingsFromTools}
          teeth={teeth}
          onUpdateTeeth={setTeeth}
        />
      )}

      {/* ── TAB 3: PRESCRIPTIONS RX ── */}
      {activeTab === 'rx' && (
        <PrescriptionsEditor
          prescriptions={prescriptions}
          onChangePrescriptions={setPrescriptions}
        />
      )}

      {/* ── TAB 4: TEMPLATE SECTIONS EXPLORER ── */}
      {activeTab === 'template_structure' && (
        <div className="card p-5 animate-fadein space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-heading">
                {templateName || `${currentSpecialtyConfig.name} Protocol`} Sections
              </h3>
              <p className="text-xs text-slate-500">Official structured EMR fields configured for {currentSpecialtyConfig.title}.</p>
            </div>
            <button
              type="button"
              onClick={() => {
                const scaffold = templateSections.map(s => `[${s.label}]:\n`).join('\n')
                setObservations(prev => (prev ? `${prev}\n\n${scaffold}` : scaffold))
                setActiveTab('soap')
                showToast('Template structure imported into Clinical Observations.')
              }}
              className="btn btn-sm btn-secondary text-xs"
            >
              📥 Import Headings into Observations
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templateSections.map((sec, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">{sec.label}</span>
                  <span className="text-[10px] font-mono text-slate-400">#{sec.key}</span>
                </div>
                {sec.placeholder && (
                  <p className="text-[11px] text-slate-500 italic">Prompt: {sec.placeholder}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}