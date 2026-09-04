import { useState } from 'react'
import api from '../services/api'

interface QueuePatient {
  id: string
  tokenNumber: string
  patientName: string
  doctorName: string
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
  const [queue, setQueue] = useState<QueuePatient[]>([

    { id: '1', tokenNumber: 'A-12', patientName: 'Meera R.', doctorName: 'Dr. Mehta', status: 'waiting', priority: 'emergency', arrivalTime: '10:05 AM', waitMinutes: 12 },
    { id: '2', tokenNumber: 'A-13', patientName: 'Priya Singh', doctorName: 'Dr. Mehta', status: 'in_consultation', priority: 'normal', arrivalTime: '09:45 AM', waitMinutes: 18 },
    { id: '3', tokenNumber: 'A-14', patientName: 'Ravi Kumar', doctorName: 'Dr. Mehta', status: 'waiting', priority: 'normal', arrivalTime: '10:10 AM', waitMinutes: 8 },
    { id: '4', tokenNumber: 'A-15', patientName: 'Anil Verma', doctorName: 'Dr. Mehta', status: 'waiting', priority: 'normal', arrivalTime: '10:15 AM', waitMinutes: 3 },
  ])

  const [logs, setLogs] = useState<PriorityLogEntry[]>([
    { time: '10:15', user: 'Meera R.', change: 'Normal → Emergency', reason: 'Severe acute abdominal pain' },
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
      // Continue locally on mock/dev fallback
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

  const waitingCount = queue.filter(q => q.status === 'waiting').length
  const inConsultCount = queue.filter(q => q.status === 'in_consultation').length

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Live OPD Queue</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Real-time queue sequencing and emergency escalation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Real-time Sync Active</span>
          </div>
        </div>
      </div>

      {toast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* ── Metrics Row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Waiting Patients</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{waitingCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Consultation</span>
          <div className="text-3xl font-extrabold text-emerald-600 mt-2">{inConsultCount}</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Wait</span>
          <div className="text-3xl font-extrabold text-slate-800 mt-2">14 min</div>
        </div>
      </div>

      {/* ── Queue Table & Priority Logs ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Current Queue Sequence</h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Token</th>
                  <th className="py-2.5 px-3">Patient</th>
                  <th className="py-2.5 px-3">Doctor</th>
                  <th className="py-2.5 px-3">Wait Time</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {queue.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-slate-900 px-2 py-1 bg-slate-100 rounded-lg">
                        {patient.tokenNumber}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{patient.patientName}</div>
                      <div className="text-[11px] text-slate-400">{patient.arrivalTime}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{patient.doctorName}</td>
                    <td className="py-3 px-3 text-slate-600">{patient.waitMinutes} mins</td>
                    <td className="py-3 px-3">
                      {patient.priority === 'emergency' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Emergency
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => openEmergencyModal(patient)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          patient.priority === 'emergency'
                            ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                            : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60'
                        }`}
                      >
                        {patient.priority === 'emergency' ? 'Set Normal' : 'Mark Emergency'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Priority Change Audit Logs (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">Priority Audit Log</h2>
          <div className="space-y-3">
            {logs.map((log, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-xs">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadein">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {selectedPatient.priority === 'emergency' ? 'Revert to Normal Priority' : 'Mark Patient as Emergency'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Patient: <span className="font-bold text-slate-900">{selectedPatient.patientName}</span> ({selectedPatient.tokenNumber})
            </p>

            {selectedPatient.priority !== 'emergency' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason for Emergency Escalation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={emergencyReason}
                  onChange={(e) => {
                    setEmergencyReason(e.target.value)
                    setReasonError('')
                  }}
                  placeholder="e.g. Severe chest pain, acute bleeding, dyspnea..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                />
                {reasonError && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">{reasonError}</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              {selectedPatient.priority === 'emergency' ? (
                <button
                  onClick={() => submitPriorityChange('normal')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 shadow-md"
                >
                  Confirm Revert
                </button>
              ) : (
                <button
                  onClick={() => submitPriorityChange('emergency')}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-700/20"
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
