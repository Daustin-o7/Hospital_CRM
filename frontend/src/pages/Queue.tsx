import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { EmptyState, SkeletonTableRow } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'

interface QueueAppointment {
  id: string
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
  const [selectedDoctor, setSelectedDoctor] = useState('all')
  const [appointments, setAppointments] = useState<QueueAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<PriorityLogEntry[]>([])
  const [toast, setToast] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<QueueAppointment | null>(null)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchQueue = useCallback(async (quiet = false) => {
    try {
      if (!quiet) setLoading(true)
      setError(null)
      const res = await api.get(`/appointments?date=${todayParam()}`)
      setAppointments(res.data.map((a: any) => ({
        id: a.appointmentId,
        tokenNumber: a.queueToken != null ? `A-${a.queueToken}` : a.time,
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

  const doctors = [...new Set(appointments.map(a => a.doctorName))]

  const openEmergencyModal = (patient: QueueAppointment) => {
    setSelectedPatient(patient)
    setEmergencyReason('')
    setReasonError('')
    setModalOpen(true)
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
        showToast(`Priority for ${selectedPatient.patientName} updated to ${newPriority.toUpperCase()}.`)
      } else {
        showToast(`Priority for ${selectedPatient.patientName} was already ${newPriority.toUpperCase()}.`)
      }
      setModalOpen(false)
    } catch (err) {
      showToast(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const filteredQueue = appointments.filter(q => selectedDoctor === 'all' || q.doctorName === selectedDoctor)

  const waitingCount = filteredQueue.filter(q => q.status === 'waiting').length
  const completedCount = filteredQueue.filter(q => q.status === 'completed').length
  const emergencyCount = filteredQueue.filter(q => q.priority === 'emergency').length

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse"></span>
              Live Queue Synchronization Active
            </span>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">OPD Desks</span>
          </div>
          <h1 className="page-title font-heading mt-1 flex items-center gap-2">
            <span>Live OPD Queue &amp; Triage Desk</span>
          </h1>
          <p className="page-description">
            Real-time patient sequencing and statutory emergency escalation (MOD-24). Auto-refreshes every 30 seconds.
          </p>
        </div>

        {doctors.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="card flex items-center gap-1.5 p-1 bg-[var(--color-surface-raised)] overflow-x-auto">
              <button
                onClick={() => setSelectedDoctor('all')}
                className={`btn btn-sm ${selectedDoctor === 'all' ? 'btn-primary' : 'btn-ghost'} shrink-0`}
              >
                All Desks
              </button>
              {doctors.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDoctor(d)}
                  className={`btn btn-sm ${selectedDoctor === d ? 'btn-primary' : 'btn-ghost'} shrink-0`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div className="alert alert-success">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
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
            <span className="badge badge-warning">
              Live Queue
            </span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono">{loading ? '—' : waitingCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Checked in, awaiting consultation</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Completed Today</span>
            <span className="badge badge-brand">
              Seen
            </span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono">{loading ? '—' : completedCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Consultations closed today</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Emergency Triaged</span>
            <span className="badge badge-danger">
              Priority 1
            </span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono text-rose-600 dark:text-rose-400">
            {loading ? '—' : emergencyCount}
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Fast-tracked for doctor review</p>
        </div>
      </div>

      {/* ── Queue Table & Priority Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue Table (8 cols) */}
        <div className="card lg:col-span-8 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Sequential Patient Tokens</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Emergency first, then by scheduled slot</p>
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
                  <th>Patient</th>
                  <th>Doctor &amp; Slot</th>
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
                          : 'No patients match the selected desk.'}
                      />
                    </td>
                  </tr>
                )}

                {!loading && filteredQueue.map((patient) => (
                  <tr key={patient.id} className="transition-colors">
                    <td>
                      <span className="queue-token">
                        {patient.tokenNumber}
                      </span>
                    </td>
                    <td>
                      <div className="font-bold text-[var(--color-text)]">{patient.patientName}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">Slot: {patient.time}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-[var(--color-text-secondary)]">{patient.doctorName}</div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {patient.priority === 'emergency' ? (
                          <span className="badge badge-danger animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Emergency
                          </span>
                        ) : null}
                        {patient.status === 'waiting' ? (
                          <span className="badge badge-warning">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> In Lobby
                          </span>
                        ) : patient.status === 'completed' ? (
                          <span className="badge badge-success">Completed</span>
                        ) : (
                          <span className="badge badge-neutral">Expected</span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      {patient.status === 'waiting' && (
                        <button
                          onClick={() => openEmergencyModal(patient)}
                          className={`btn btn-sm cursor-pointer ${
                            patient.priority === 'emergency' ? 'btn-secondary' : 'btn-danger'
                          }`}
                        >
                          {patient.priority === 'emergency' ? 'Set Normal' : 'Triage Emergency'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Change Audit Logs (4 cols) */}
        <div className="card lg:col-span-4 p-5 space-y-4">
          <div className="border-b border-[var(--color-border)] pb-3">
            <h2 className="text-sm font-bold text-[var(--color-text)] tracking-tight font-heading">Triage Audit Trail</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">Changes made this session — the full server-side log persists in the priority audit table</p>
          </div>
          {logs.length === 0 ? (
            <EmptyState
              title="No Triage Changes Yet"
              description="Priority escalations and reverts you make in this session will appear here."
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
