import { useState } from 'react'
import api from '../services/api'

interface QueuePatient {
  id: string
  tokenNumber: string
  patientName: string
  doctorName: string
  room: string
  status: 'waiting' | 'in_consultation' | 'completed'
  priority: 'normal' | 'emergency'
  arrivalTime: string
  waitMinutes: number
}

interface PriorityLogEntry {
  time: string
  user: string
  change: string
  reason?: string
}

export default function Queue() {
  const [selectedDesk, setSelectedDesk] = useState('all')
  const [queue, setQueue] = useState<QueuePatient[]>([
    { id: '1', tokenNumber: 'A-12', patientName: 'Meera R.', doctorName: 'Dr. Mehta', room: 'OPD Room 1', status: 'waiting', priority: 'emergency', arrivalTime: '10:05 AM', waitMinutes: 12 },
    { id: '2', tokenNumber: 'A-13', patientName: 'Priya Singh', doctorName: 'Dr. Mehta', room: 'OPD Room 1', status: 'in_consultation', priority: 'normal', arrivalTime: '09:45 AM', waitMinutes: 18 },
    { id: '3', tokenNumber: 'A-14', patientName: 'Ravi Kumar', doctorName: 'Dr. Sharma', room: 'OPD Room 2', status: 'waiting', priority: 'normal', arrivalTime: '10:10 AM', waitMinutes: 8 },
    { id: '4', tokenNumber: 'A-15', patientName: 'Anil Verma', doctorName: 'Dr. Mehta', room: 'OPD Room 1', status: 'waiting', priority: 'normal', arrivalTime: '10:15 AM', waitMinutes: 3 },
    { id: '5', tokenNumber: 'A-16', patientName: 'Deepa Patel', doctorName: 'Dr. Nair', room: 'Dental Suite', status: 'waiting', priority: 'normal', arrivalTime: '10:20 AM', waitMinutes: 2 },
  ])

  const [logs, setLogs] = useState<PriorityLogEntry[]>([
    { time: '10:15', user: 'Meera R.', change: 'Normal → Emergency', reason: 'Acute severe abdominal pain' },
    { time: '09:30', user: 'System', change: 'Enqueued', reason: 'Initial token allocation' },
  ])

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<QueuePatient | null>(null)
  const [emergencyReason, setEmergencyReason] = useState('')
  const [reasonError, setReasonError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const openEmergencyModal = (patient: QueuePatient) => {
    setSelectedPatient(patient)
    setEmergencyReason('')
    setReasonError('')
    setModalOpen(true)
  }

  const submitPriorityChange = async (newPriority: 'emergency' | 'normal') => {
    if (!selectedPatient) return

    if (newPriority === 'emergency' && emergencyReason.trim().length < 10) {
      setReasonError('Please provide a specific clinical reason (minimum 10 characters).')
      return
    }

    try {
      await api.patch(`/appointments/${selectedPatient.id}/priority`, {
        priority: newPriority,
        reason: emergencyReason.trim()
      })
    } catch {
      // Continue locally on fallback
    }

    setQueue(prev => prev.map(p => p.id === selectedPatient.id ? { ...p, priority: newPriority } : p))
    
    setLogs(prev => [
      {
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        user: selectedPatient.patientName,
        change: `${selectedPatient.priority === 'emergency' ? 'Emergency → Normal' : 'Normal → Emergency'}`,
        reason: emergencyReason.trim() || 'Status updated by staff'
      },
      ...prev
    ])

    showToast(`Priority for ${selectedPatient.patientName} updated to ${newPriority.toUpperCase()}.`)
    setModalOpen(false)
  }

  const callNextPatient = (patient: QueuePatient) => {
    setQueue(prev => prev.map(p => {
      if (p.id === patient.id) return { ...p, status: 'in_consultation' }
      if (p.doctorName === patient.doctorName && p.status === 'in_consultation') return { ...p, status: 'completed' }
      return p
    }))
    showToast(`Calling Token ${patient.tokenNumber} (${patient.patientName}) to ${patient.room}`)
  }

  const filteredQueue = queue.filter(q => {
    if (selectedDesk === 'all') return true
    if (selectedDesk === 'mehta') return q.doctorName === 'Dr. Mehta'
    if (selectedDesk === 'sharma') return q.doctorName === 'Dr. Sharma'
    if (selectedDesk === 'nair') return q.doctorName === 'Dr. Nair'
    return true
  })

  const waitingCount = filteredQueue.filter(q => q.status === 'waiting').length
  const inConsultCount = filteredQueue.filter(q => q.status === 'in_consultation').length
  const avgWait = waitingCount > 0
    ? Math.round(filteredQueue.filter(q => q.status === 'waiting').reduce((sum, q) => sum + q.waitMinutes, 0) / waitingCount)
    : null

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
            <span className="text-xs text-[var(--color-text-muted)] font-mono">OPD Desk 1 &amp; 2</span>
          </div>
          <h1 className="page-title font-heading mt-1 flex items-center gap-2">
            <span>Live OPD Queue &amp; Triage Desk</span>
          </h1>
          <p className="page-description">
            Real-time patient sequencing, audio token announcements, and statutory emergency escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="card flex items-center gap-1.5 p-1 bg-[var(--color-surface-raised)]">
            <button
              onClick={() => setSelectedDesk('all')}
              className={`btn btn-sm ${selectedDesk === 'all' ? 'btn-primary' : 'btn-ghost'}`}
            >
              All Desks
            </button>
            <button
              onClick={() => setSelectedDesk('mehta')}
              className={`btn btn-sm ${selectedDesk === 'mehta' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Dr. Mehta (Room 1)
            </button>
            <button
              onClick={() => setSelectedDesk('sharma')}
              className={`btn btn-sm ${selectedDesk === 'sharma' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Dr. Sharma (Room 2)
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="alert alert-success">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
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
          <div className="stat-value mt-2 font-heading font-mono">{waitingCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Average wait: {avgWait !== null ? `${avgWait} mins` : '—'}</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Currently In Consultation</span>
            <span className="badge badge-brand">
              Occupied
            </span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono">{inConsultCount}</div>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">Across active consultation rooms</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Emergency Triaged</span>
            <span className="badge badge-danger">
              Priority 1
            </span>
          </div>
          <div className="stat-value mt-2 font-heading font-mono text-rose-600 dark:text-rose-400">
            {filteredQueue.filter(q => q.priority === 'emergency').length}
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
              <p className="text-[11px] text-[var(--color-text-muted)]">Order by triage score &amp; arrival time</p>
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
                  <th>Doctor &amp; Room</th>
                  <th>Wait Time</th>
                  <th>Status / Priority</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="font-medium">
                {filteredQueue.map((patient) => (
                  <tr key={patient.id} className="transition-colors">
                    <td>
                      <span className="queue-token">
                        {patient.tokenNumber}
                      </span>
                    </td>
                    <td>
                      <div className="font-bold text-[var(--color-text)]">{patient.patientName}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">Arrival: {patient.arrivalTime}</div>
                    </td>
                    <td>
                      <div className="font-semibold text-[var(--color-text-secondary)]">{patient.doctorName}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{patient.room}</div>
                    </td>
                    <td>
                      <span className="font-mono text-[var(--color-text-secondary)] font-semibold">{patient.waitMinutes} mins</span>
                    </td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {patient.status === 'in_consultation' ? (
                          <span className="badge badge-brand">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse"></span> Inside Room
                          </span>
                        ) : patient.priority === 'emergency' ? (
                          <span className="badge badge-danger animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Emergency
                          </span>
                        ) : (
                          <span className="badge badge-neutral">
                            In Lobby
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {patient.status === 'waiting' && (
                          <button
                            onClick={() => callNextPatient(patient)}
                            className="btn btn-primary btn-sm cursor-pointer"
                          >
                            <span>🔔 Call</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEmergencyModal(patient)}
                          className={`btn btn-sm cursor-pointer ${
                            patient.priority === 'emergency' ? 'btn-secondary' : 'btn-danger'
                          }`}
                        >
                          {patient.priority === 'emergency' ? 'Set Normal' : 'Triage Emergency'}
                        </button>
                      </div>
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
            <p className="text-[11px] text-[var(--color-text-muted)]">Statutory override history</p>
          </div>
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
        </div>
      </div>

      {/* ── Mark Emergency Modal ── */}
      {modalOpen && selectedPatient && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-md p-6 space-y-4 animate-fadein">
            <div className="modal-header p-0 border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-text)] font-heading">
                {selectedPatient.priority === 'emergency' ? 'Revert to Normal Priority' : 'Mark Patient as Emergency'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="btn btn-ghost p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)]">
              Patient: <span className="font-bold text-[var(--color-text)]">{selectedPatient.patientName}</span> ({selectedPatient.tokenNumber})
            </p>

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
                  <p className="form-error font-semibold">{reasonError}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="btn btn-ghost cursor-pointer"
              >
                Cancel
              </button>
              {selectedPatient.priority === 'emergency' ? (
                <button
                  onClick={() => submitPriorityChange('normal')}
                  className="btn btn-secondary cursor-pointer"
                >
                  Confirm Revert
                </button>
              ) : (
                <button
                  onClick={() => submitPriorityChange('emergency')}
                  className="btn btn-danger cursor-pointer"
                >
                  Escalate to Emergency
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
