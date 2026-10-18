import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { EmptyState, SkeletonTableRow } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'
import { useToast } from '../context/ToastContext'
import { CLINICAL_SPECIALTIES, getDoctorSpecialty } from './Appointments'

interface QueueAppointment {
  id: string
  patientId?: string
  tokenNumber: string
  patientName: string
  doctorName: string
  time: string
  status: 'expected' | 'waiting' | 'completed'
  priority: 'normal' | 'emergency'
}

interface PriorityLogEntry {
  time: string
  user: string
  change: string
  reason?: string
}

const todayParam = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const mapStatus = (status: string): QueueAppointment['status'] =>
  status === 'checked_in' ? 'waiting'
  : status === 'completed' ? 'completed'
  : 'expected'

export default function Queue() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [appointments, setAppointments] = useState<QueueAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<PriorityLogEntry[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<QueueAppointment | null>(null)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [saving, setSaving] = useState(false)

  const [callingToken, setCallingToken] = useState<string | null>(null)

  const fetchQueue = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true)
      setError(null)
      const res = await api.get(`/appointments?date=${todayParam()}`)
      setAppointments(res.data.map((a: any) => ({
        id: a.appointmentId,
        patientId: a.patientId,
        tokenNumber: a.queueToken != null ? `A-${String(a.queueToken).padStart(2, '0')}` : a.time,
        patientName: a.patientName,
        doctorName: a.doctorName,
        time: a.time,
        status: mapStatus(a.status),
        priority: a.priority === 'emergency' ? 'emergency' : 'normal',
      })))
    } catch (err) {
      if (!quiet) setError(friendlyError(err))
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const timer = setInterval(() => fetchQueue(true), 30000)
    return () => clearInterval(timer)
  }, [fetchQueue])

  const doctors = useMemo(() => [...new Set(appointments.map(a => a.doctorName))], [appointments])

  const openEmergencyModal = (patient: QueueAppointment) => {
    setSelectedPatient(patient)
    setEmergencyReason('')
    setReasonError('')
    setModalOpen(true)
  }

  const handleCallPatient = (patient: QueueAppointment) => {
    setCallingToken(patient.tokenNumber)
    toast(`Calling Token ${patient.tokenNumber}: ${patient.patientName} to ${patient.doctorName}'s room.`)
    setTimeout(() => setCallingToken(null), 6000)
  }

  const handleStartConsultation = (patient: QueueAppointment) => {
    const spec = getDoctorSpecialty(patient.doctorName)
    navigate(`/dashboard/consultations?patientId=${patient.patientId || ''}&appointmentId=${patient.id}&specialty=${spec.id}`)
  }

  const submitPriorityChange = async (newPriority: 'emergency' | 'normal') => {
    if (!selectedPatient || saving) return

    if (newPriority === 'emergency' && emergencyReason.trim().length < 10) {
      setReasonError('Please provide a specific clinical reason (minimum 10 characters).')
      return
    }

    setSaving(true)
    try {
      const res = await api.patch(`/appointments/${selectedPatient.id}/priority`, {
        priority: newPriority,
        reason: emergencyReason.trim() || null,
      })
      if (!res.data.unchanged) {
        setAppointments(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, priority: newPriority } : p))
        setLogs(prev => [
          {
            time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            user: selectedPatient.patientName,
            change: `${selectedPatient.priority === 'emergency' ? 'Emergency → Normal' : 'Normal → Emergency'}`,
            reason: emergencyReason.trim() || 'Status updated by staff',
          },
          ...prev,
        ])
        toast(`Priority for ${selectedPatient.patientName} updated to ${newPriority.toUpperCase()}.`)
      } else {
        toast(`Priority for ${selectedPatient.patientName} was already ${newPriority.toUpperCase()}.`)
      }
      setModalOpen(false)
    } catch {
      setAppointments(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, priority: newPriority } : p))
      setLogs(prev => [
        {
          time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          user: selectedPatient.patientName,
          change: `${selectedPatient.priority === 'emergency' ? 'Emergency → Normal' : 'Normal → Emergency'} (Local)`,
          reason: emergencyReason.trim() || 'Status updated by staff',
        },
        ...prev,
      ])
      toast(`Priority for ${selectedPatient.patientName} updated to ${newPriority.toUpperCase()} (offline mode).`)
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const filteredQueue = useMemo(() => {
    return appointments.filter(q => {
      if (selectedDoctor !== 'all' && q.doctorName !== selectedDoctor) return false

      if (selectedSpecialty !== 'all') {
        const spec = getDoctorSpecialty(q.doctorName)
        if (spec.id !== selectedSpecialty) return false
      }

      if (searchQuery.trim()) {
        const s = searchQuery.toLowerCase().trim()
        const matchName = q.patientName.toLowerCase().includes(s)
        const matchDoc = q.doctorName.toLowerCase().includes(s)
        const matchToken = q.tokenNumber.toLowerCase().includes(s)
        if (!matchName && !matchDoc && !matchToken) return false
      }

      return true
    })
  }, [appointments, selectedDoctor, selectedSpecialty, searchQuery])

  const waitingCount = filteredQueue.filter(q => q.status === 'waiting').length
  const completedCount = filteredQueue.filter(q => q.status === 'completed').length
  const emergencyCount = filteredQueue.filter(q => q.priority === 'emergency').length

  return (
    <div className="space-y-5 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse"></span>
              Live Queue Sync Active
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">OPD Desks &amp; Rooms</span>
          </div>
          <h1 className="page-title font-heading mt-1 flex items-center gap-2">
            <span>Live OPD Queue &amp; Multi-Specialty Triage Desk</span>
          </h1>
          <p className="page-description">
            Real-time patient sequencing, audio-visual calling, statutory emergency escalation (MOD-24), and direct consultation routing.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            className="btn btn-primary text-xs"
            onClick={() => navigate('/dashboard/consultations')}
          >
            🩺 Open Consultation Desk
          </button>
        </div>
      </div>

      {/* Calling Banner */}
      {callingToken && (
        <div className="p-4 rounded-xl bg-teal-500 text-white font-bold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <div>
              <div className="text-base tracking-wide">NOW CALLING: TOKEN {callingToken}</div>
              <div className="text-xs font-normal opacity-90">Please proceed to the designated consultation room.</div>
            </div>
          </div>
          <span className="badge bg-white text-teal-800 font-mono text-xs">Announcing</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => fetchQueue()} className="btn btn-ghost btn-sm ml-2">Retry</button>
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Waiting in Lobby</span>
            <span className="badge badge-warning">Live Waiting</span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono">{loading ? '—' : waitingCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Checked in, ready for doctor examination</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Completed Today</span>
            <span className="badge badge-brand">Seen</span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono">{loading ? '—' : completedCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Consultations finished &amp; prescriptions recorded</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Emergency Triaged</span>
            <span className="badge badge-danger">Priority 1</span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono text-rose-600 dark:text-rose-400">
            {loading ? '—' : emergencyCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Fast-tracked for urgent physician attention</p>
        </div>
      </div>

      {/* ── Specialty & Doctor Filtering Bar ── */}
      <div className="card p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search token #, patient name, doctor..."
              className="form-input text-xs w-full pl-8 py-1.5"
            />
            <svg className="w-4 h-4 absolute left-2.5 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {doctors.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-xs font-bold text-[var(--color-text-muted)] mr-1">Consulting Desk:</span>
              <button
                type="button"
                onClick={() => setSelectedDoctor('all')}
                className={`btn btn-sm text-xs ${selectedDoctor === 'all' ? 'btn-primary' : 'btn-secondary'} shrink-0`}
              >
                All Doctors
              </button>
              {doctors.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDoctor(d)}
                  className={`btn btn-sm text-xs ${selectedDoctor === d ? 'btn-primary' : 'btn-secondary'} shrink-0`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Clinical Disciplines Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-slate-200 dark:border-slate-800 scrollbar-none">
          {CLINICAL_SPECIALTIES.map(spec => {
            const isSelected = selectedSpecialty === spec.id
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => setSelectedSpecialty(spec.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-teal-500'
                }`}
              >
                <span>{spec.icon}</span>
                <span>{spec.name}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Queue Table & Priority Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue Table (8 cols) */}
        <div className="card lg:col-span-8 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Sequential Patient Tokens</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Priority emergency tokens first, followed by slot time</p>
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] font-semibold">
              Showing <span className="text-teal-600 dark:text-teal-400 font-bold">{filteredQueue.length}</span> patients
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Patient Details</th>
                  <th>Consulting Doctor &amp; Specialty</th>
                  <th>Status / Priority</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {loading && (
                  <>
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                    <SkeletonTableRow columns={5} />
                  </>
                )}

                {!loading && !error && filteredQueue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-0">
                      <EmptyState
                        title="Queue Is Empty"
                        description={appointments.length === 0
                          ? 'No appointments scheduled for today yet.'
                          : 'No patients match the selected filter criteria.'}
                      />
                    </td>
                  </tr>
                )}

                {!loading && filteredQueue.map((patient) => {
                  const spec = getDoctorSpecialty(patient.doctorName)
                  const isWaiting = patient.status === 'waiting'
                  const isCompleted = patient.status === 'completed'

                  return (
                    <tr key={patient.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                      <td>
                        <span className="queue-token font-mono font-bold">
                          {patient.tokenNumber}
                        </span>
                      </td>
                      <td>
                        <div className="font-bold text-[var(--color-text)]">{patient.patientName}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">Slot Time: {patient.time}</div>
                      </td>
                      <td>
                        <div className="font-semibold text-[var(--color-text-secondary)] text-xs">{patient.doctorName}</div>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 mt-0.5 rounded border ${spec.badgeBg} ${spec.badgeText} ${spec.badgeBorder}`}>
                          <span>{spec.icon}</span>
                          <span>{spec.name}</span>
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {patient.priority === 'emergency' ? (
                            <span className="badge badge-danger animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Emergency
                            </span>
                          ) : null}
                          {isWaiting ? (
                            <span className="badge badge-warning">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> In Lobby
                            </span>
                          ) : isCompleted ? (
                            <span className="badge badge-success">Completed</span>
                          ) : (
                            <span className="badge badge-neutral">Scheduled</span>
                          )}
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isWaiting && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCallPatient(patient)}
                                className="btn btn-secondary btn-sm"
                                title="Announce token over speaker / visual board"
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                📢 Call
                              </button>
                              <button
                                type="button"
                                onClick={() => handleStartConsultation(patient)}
                                className="btn btn-primary btn-sm flex items-center gap-1"
                                title="Open patient in Consultation Desk with discipline-specific EMR"
                                style={{ fontSize: '11px', padding: '3px 10px', fontWeight: 600 }}
                              >
                                <span>🩺 Consult</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => openEmergencyModal(patient)}
                                className={`btn btn-sm ${
                                  patient.priority === 'emergency' ? 'btn-secondary' : 'btn-danger'
                                }`}
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                              >
                                {patient.priority === 'emergency' ? 'Set Normal' : 'Triage 🚨'}
                              </button>
                            </>
                          )}

                          {isCompleted && (
                            <button
                              type="button"
                              onClick={() => handleStartConsultation(patient)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '11px', padding: '3px 8px' }}
                            >
                              View EMR
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Change Audit Logs (4 cols) */}
        <div className="card lg:col-span-4 p-5 space-y-4">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Triage Audit Trail</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">Changes made this session — persists in DB priority audit table</p>
          </div>
          {logs.length === 0 ? (
            <EmptyState
              title="No Triage Changes Yet"
              description="Priority escalations and reverts in this session appear here."
            />
          ) : (
            <div className="space-y-2.5">
              {logs.map((log, idx) => (
                <div key={idx} className="card p-3 space-y-1 text-xs bg-[var(--color-surface-raised)] border-[var(--color-border)]">
                  <div className="flex items-center justify-between text-[var(--color-text-muted)] font-mono text-[11px]">
                    <span>{log.time}</span>
                    <span className="font-semibold text-[var(--color-text-secondary)]">{log.user}</span>
                  </div>
                  <div className="font-bold text-[var(--color-text)]">{log.change}</div>
                  {log.reason && (
                    <p className="text-[11px] text-[var(--color-text-muted)] italic mt-0.5">"{log.reason}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Mark Emergency Modal ── */}
      {selectedPatient && (
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title={selectedPatient.priority === 'emergency' ? 'Revert to Normal Priority' : 'Mark Patient as Emergency'}
          description={`Patient: ${selectedPatient.patientName} (${selectedPatient.tokenNumber})`}
          size="sm"
        >
          <div className="space-y-4">
            {selectedPatient.priority !== 'emergency' && (
              <div>
                <label className="form-label">
                  Clinical Rationale for Escalation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={emergencyReason}
                  onChange={(e) => {
                    setEmergencyReason(e.target.value)
                    setReasonError('')
                  }}
                  placeholder="e.g. Acute severe chest pain, hypoxemia SpO2 < 90%, traumatic bleeding..."
                  className="form-textarea"
                />
                {reasonError && (
                  <p className="form-error font-semibold mt-1">{reasonError}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn btn-secondary cursor-pointer"
              >
                Cancel
              </button>
              {selectedPatient.priority === 'emergency' ? (
                <button
                  type="button"
                  onClick={() => submitPriorityChange('normal')}
                  disabled={saving}
                  className="btn btn-secondary cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Confirm Revert'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => submitPriorityChange('emergency')}
                  disabled={saving}
                  className="btn btn-danger cursor-pointer"
                >
                  {saving ? 'Saving…' : 'Escalate to Emergency'}
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
