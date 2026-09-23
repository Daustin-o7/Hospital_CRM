import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'

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
  { id: 46, label: '46', status: 'caries',  arch: 'lower' },
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
  { id: 36, label: '36', status: 'filling',  arch: 'lower' },
  { id: 37, label: '37', status: 'healthy', arch: 'lower' },
  { id: 38, label: '38', status: 'healthy', arch: 'lower' },
]

export default function Consultations() {
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentItem | null>(null)
  const [activeTab, setActiveTab] = useState<'soap' | 'dental' | 'rx' | 'history'>('soap')
  const [templateType, setTemplateType] = useState<'General' | 'Dental' | 'Ayurveda'>('General')
  
  // Clinical state
  const [chiefComplaint, setChiefComplaint] = useState('Throat irritation and mild fever since 2 days')
  const [observations, setObservations] = useState('Pharyngeal erythema present. No tonsillar exudates. Chest clear.')
  const [diagnosis, setDiagnosis] = useState('Acute Viral Pharyngitis')
  const [teeth, setTeeth] = useState<ToothStatus[]>(INITIAL_TEETH)
  
  // Prescriptions state
  const [prescriptions, setPrescriptions] = useState<PrescriptionDraft[]>([
    { medicine: 'Tab. Paracetamol 650mg', dosage: '1 Tab', frequency: 'TID (After Food)', duration: '3 Days' },
    { medicine: 'Tab. Cetirizine 10mg', dosage: '1 Tab', frequency: 'HS (Night)', duration: '5 Days' }
  ])
  const [medQuery, setMedQuery] = useState('')
  const [medHits, setMedHits] = useState<MedicineHit[]>([])
  const [isSearchingMeds, setIsSearchingMeds] = useState(false)

  const [activeConsultationId, setActiveConsultationId] = useState<string | null>(null)
  const [versionNumber, setVersionNumber] = useState(1)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const showToast = (msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Load appointment queue
  const fetchAppointments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/appointments')
      const items: AppointmentItem[] = (res.data || []).map((a: any) => ({
        id: a.id || a.appointmentId,
        patientId: a.patientId,
        patientName: a.patientName || a.patient?.name || 'Walk-in Patient',
        patientPhone: a.patientPhone || a.patient?.phone || '',
        doctorName: a.doctorName || a.doctor?.name,
        status: a.status || 'Scheduled',
        appointmentDate: a.appointmentDate || a.scheduledAt || new Date().toISOString(),
        queueNumber: a.queueNumber || 1
      }))
      setAppointments(items)
      if (items.length > 0 && !selectedAppointment) {
        setSelectedAppointment(items[0])
      }
    } catch (err) {
      console.warn('Appointments fetch:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedAppointment])

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
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Consultation Desk</h1>
          <p className="page-description">Clinical examination, SOAP notes, dental odontograms, and digital Rx.</p>
        </div>

        <div className="flex items-center gap-2">
          {activeConsultationId ? (
            <button
              onClick={() => handleSaveConsultation(true)}
              disabled={submitting}
              className="btn btn-secondary"
            >
              Amend Clinical Note (v{versionNumber})
            </button>
          ) : (
            <button
              onClick={() => handleSaveConsultation(false)}
              disabled={submitting}
              className="btn btn-primary"
            >
              {submitting ? 'Saving Note…' : 'Save Consultation (v1)'}
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
      <div className="card" style={{ padding: 20 }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-lg shadow-md"
              style={{
                background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                fontFamily: 'var(--font-heading)'
              }}
            >
              {selectedAppointment?.patientName ? selectedAppointment.patientName.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                  {selectedAppointment?.patientName || 'No patient selected'}
                </h2>
                <span className="badge badge-success">
                  Active Consultation
                </span>
                {activeConsultationId && (
                  <span className="badge badge-primary">
                    v{versionNumber} Note
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Phone: {selectedAppointment?.patientPhone || '—'} • Queue: #{selectedAppointment?.queueNumber || 1} • Status: {selectedAppointment?.status || 'Active'}
              </p>
            </div>
          </div>

          {/* Queue Selector */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Select Queue Patient:</label>
            <select
              value={selectedAppointment?.id || ''}
              disabled={loading}
              onChange={(e) => {
                const found = appointments.find(a => a.id === e.target.value)
                if (found) {
                  setSelectedAppointment(found)
                  setActiveConsultationId(null)
                  setVersionNumber(1)
                }
              }}
              className="form-select text-xs py-1.5"
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

      {/* ── Consultation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('soap')}
          className={`btn btn-sm ${activeTab === 'soap' ? 'btn-primary' : 'btn-ghost'}`}
        >
          SOAP & Clinical Notes
        </button>
        <button
          onClick={() => setActiveTab('dental')}
          className={`btn btn-sm ${activeTab === 'dental' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Odontogram (Dental Chart)
        </button>
        <button
          onClick={() => setActiveTab('rx')}
          className={`btn btn-sm ${activeTab === 'rx' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Prescription Rx ({prescriptions.length})
        </button>
      </div>

      {/* ── Tab Content: SOAP Notes ── */}
      {activeTab === 'soap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="card" style={{ padding: 20 }}>
              <div className="form-group">
                <label className="form-label">Chief Complaint & Symptoms</label>
                <textarea
                  rows={3}
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="Patient's primary complaint, duration, severity…"
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Observations & Physical Examination</label>
                <textarea
                  rows={4}
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Vitals, systemic examination findings, ENT/Oral findings…"
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Provisional / Final Diagnosis (ICD-11 / SNOMED)</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Acute Viral Pharyngitis, Dental Caries 46"
                  className="form-input"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card" style={{ padding: 20 }}>
              <h3 className="text-sm font-bold text-slate-900 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                Specialty Templates
              </h3>
              <p className="text-xs text-slate-500 mb-3">Load structured clinical template frameworks.</p>
              
              <div className="flex flex-col gap-2">
                {(['General', 'Dental', 'Ayurveda'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setTemplateType(t)
                      if (t === 'Dental') {
                        setChiefComplaint('Tooth pain and sensitivity in lower right quadrant')
                        setObservations('Localized tenderness in 46. Caries detected occlusally.')
                        setDiagnosis('Irreversible pulpitis in 46')
                      } else if (t === 'Ayurveda') {
                        setChiefComplaint('Vata-Pitta imbalance, chronic indigestion and lethargy')
                        setObservations('Nadi: Mandagni present. Jihva: coated (Sama).')
                        setDiagnosis('Agnimandya / Grahani')
                      } else {
                        setChiefComplaint('Throat irritation and mild fever since 2 days')
                        setObservations('Pharyngeal erythema present. No tonsillar exudates.')
                        setDiagnosis('Acute Viral Pharyngitis')
                      }
                      showToast(`Loaded ${t} consultation template.`)
                    }}
                    className={`btn btn-sm ${templateType === t ? 'btn-primary' : 'btn-secondary'} justify-start`}
                  >
                    {t} Practice Template
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Odontogram (Dental Chart) ── */}
      {activeTab === 'dental' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
                FDI Two-Digit Dental Odontogram
              </h3>
              <p className="text-xs text-slate-500">Click any tooth to cycle status: Healthy → Caries → Filling → Missing → Crown</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"/> Healthy</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"/> Caries</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"/> Filling</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block"/> Missing</span>
            </div>
          </div>

          {/* Upper Arch */}
          <div className="mb-6">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Maxilla (Upper Arch)</div>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
              {teeth.filter(t => t.arch === 'upper').map(tooth => (
                <button
                  key={tooth.id}
                  onClick={() => cycleToothStatus(tooth.id)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                    tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                    tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400' :
                    tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                    'bg-white border-slate-200 text-slate-800 hover:border-teal-500'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{tooth.label}</div>
                  <div className="text-[10px] capitalize truncate mt-0.5">{tooth.status}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Lower Arch */}
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Mandible (Lower Arch)</div>
            <div className="grid grid-cols-8 sm:grid-cols-16 gap-2">
              {teeth.filter(t => t.arch === 'lower').map(tooth => (
                <button
                  key={tooth.id}
                  onClick={() => cycleToothStatus(tooth.id)}
                  className={`p-2 rounded-xl border text-center transition-all ${
                    tooth.status === 'caries' ? 'bg-rose-50 border-rose-300 text-rose-800' :
                    tooth.status === 'filling' ? 'bg-amber-50 border-amber-300 text-amber-800' :
                    tooth.status === 'missing' ? 'bg-slate-100 border-slate-200 text-slate-400' :
                    tooth.status === 'crown' ? 'bg-purple-50 border-purple-300 text-purple-800' :
                    'bg-white border-slate-200 text-slate-800 hover:border-teal-500'
                  }`}
                >
                  <div className="text-xs font-bold font-mono">{tooth.label}</div>
                  <div className="text-[10px] capitalize truncate mt-0.5">{tooth.status}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab Content: Prescriptions Rx ── */}
      {activeTab === 'rx' && (
        <div className="card" style={{ padding: 20 }}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
                Electronic Prescription & Medicine Formulary
              </h3>
              <p className="text-xs text-slate-500">Live search against Typesense / PostgreSQL drug formulary.</p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <input
              type="text"
              value={medQuery}
              onChange={(e) => setMedQuery(e.target.value)}
              placeholder="Search formulary by brand, generic name, or composition (e.g. Paracetamol, Amoxicillin)…"
              className="form-input"
            />
            {isSearchingMeds && (
              <span className="absolute right-3 top-2.5">
                <span className="spinner spinner-sm" />
              </span>
            )}

            {medHits.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 animate-fadein">
                {medHits.map((hit) => (
                  <div
                    key={hit.id}
                    onClick={() => handleSelectMedicine(hit)}
                    className="p-2 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{hit.name}</span>
                      {hit.genericName && <span className="text-slate-500 ml-2">({hit.genericName})</span>}
                    </div>
                    <span className="badge badge-primary">{hit.dosageForm || 'Oral'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prescribed Items Table */}
          {prescriptions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Medicines Prescribed</div>
              <p className="empty-state-desc">Search drug formulary above to add prescription line items.</p>
            </div>
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
                      <td className="font-bold text-slate-900">{rx.medicine}</td>
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