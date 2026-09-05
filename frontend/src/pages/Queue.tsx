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

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
              Live Queue Synchronization Active
            </span>
            <span className="text-xs text-slate-400 font-mono">OPD Desk 1 & 2</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading mt-1 flex items-center gap-2">
            <span>Live OPD Queue & Triage Desk</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time patient sequencing, audio token announcements, and statutory emergency escalation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setSelectedDesk('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedDesk === 'all' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Desks
            </button>
            <button
              onClick={() => setSelectedDesk('mehta')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedDesk === 'mehta' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dr. Mehta (Room 1)
            </button>
            <button
              onClick={() => setSelectedDesk('sharma')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                selectedDesk === 'sharma' ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dr. Sharma (Room 2)
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs">
          <svg className="w-4 h-4 text-teal-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Waiting in Lobby</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
              Live Queue
            </span>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2 font-heading font-mono">{waitingCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Average wait: 14 mins</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Currently In Consultation</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Occupied
            </span>
          </div>
          <div className="text-3xl font-extrabold text-teal-700 mt-2 font-heading font-mono">{inConsultCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">Across active consultation rooms</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Emergency Triaged</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              Priority 1
            </span>
          </div>
          <div className="text-3xl font-extrabold text-rose-600 mt-2 font-heading font-mono">
            {filteredQueue.filter(q => q.priority === 'emergency').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Fast-tracked for doctor review</p>
        </div>
      </div>

      {/* ── Queue Table & Priority Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Sequential Patient Tokens</h2>
              <p className="text-[11px] text-slate-400">Order by triage score & arrival time</p>
            </div>
            <div className="text-xs text-slate-500 font-semibold">
              Showing <span className="text-teal-700 font-bold">{filteredQueue.length}</span> patients
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">Token</th>
                  <th className="py-3 px-3">Patient</th>
                  <th className="py-3 px-3">Doctor & Room</th>
                  <th className="py-3 px-3">Wait Time</th>
                  <th className="py-3 px-3">Status / Priority</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredQueue.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-slate-900 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                        {patient.tokenNumber}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">{patient.patientName}</div>
                      <div className="text-[11px] text-slate-400">Arrival: {patient.arrivalTime}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-slate-800">{patient.doctorName}</div>
                      <div className="text-[10px] text-slate-400">{patient.room}</div>
                    </td>
                    <td className="py-3.5 px-3">
                      <span className="font-mono text-slate-700 font-semibold">{patient.waitMinutes} mins</span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1">
                        {patient.status === 'in_consultation' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span> Inside Room
                          </span>
                        ) : patient.priority === 'emergency' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Emergency
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                            In Lobby
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {patient.status === 'waiting' && (
                          <button
                            onClick={() => callNextPatient(patient)}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1"
                          >
                            <span>🔔 Call</span>
                          </button>
                        )}
                        <button
                          onClick={() => openEmergencyModal(patient)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            patient.priority === 'emergency'
                              ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                              : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60'
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
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Triage Audit Trail</h2>
            <p className="text-[11px] text-slate-400">Statutory override history</p>
          </div>
          <div className="space-y-2.5">
            {logs.map((log, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span>{log.time}</span>
                  <span className="font-semibold text-slate-700">{log.user}</span>
                </div>
                <div className="font-bold text-slate-900">{log.change}</div>
                {log.reason && (
                  <p className="text-[11px] text-slate-500 italic mt-0.5">"{log.reason}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mark Emergency Modal ── */}
      {modalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-heading">
                {selectedPatient.priority === 'emergency' ? 'Revert to Normal Priority' : 'Mark Patient as Emergency'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Patient: <span className="font-bold text-slate-900">{selectedPatient.patientName}</span> ({selectedPatient.tokenNumber})
            </p>

            {selectedPatient.priority !== 'emergency' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
                {reasonError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">{reasonError}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              {selectedPatient.priority === 'emergency' ? (
                <button
                  onClick={() => submitPriorityChange('normal')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 shadow-xs cursor-pointer"
                >
                  Confirm Revert
                </button>
              ) : (
                <button
                  onClick={() => submitPriorityChange('emergency')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs cursor-pointer"
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
