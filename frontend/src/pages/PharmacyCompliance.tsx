import { useState, useEffect } from 'react'
import api from '../services/api'
import { Alert } from '../components/ui/Alert'

interface ComplianceRecord {
  id: string
  scheduleClass: string
  drugName: string
  batchNumber: string
  quantity: number
  patientName: string
  patientAddress: string
  prescriberName: string
  prescriberRegNo: string
  dispenserName: string
  dispensedAt: string
}

export default function PharmacyCompliance() {
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  const fetchRegister = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/pharmacy/compliance/register', {
        params: {
          schedule: selectedSchedule || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined
        }
      })
      setRecords(res.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load statutory compliance register')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRegister()
  }, [selectedSchedule, startDate, endDate])

  const exportInspectionCsv = async () => {
    try {
      const res = await api.get('/pharmacy/compliance/register', {
        params: {
          schedule: selectedSchedule || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          exportCsv: true
        },
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `statutory_schedule_h1_register_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError('Failed to export compliance register CSV')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-200">
              CDSCO & NDPS Act Statutory Compliance
            </span>
            <span className="text-xs text-slate-500 font-mono">Form 20/21 Mandated Register</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Controlled Substance & Schedule H1 Register</h1>
          <p className="text-sm text-slate-500">
            Immutable audit record of restricted 3rd/4th generation antibiotics, sedatives, and narcotics per 2013 Gazette notification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportInspectionCsv}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Drug Inspector CSV
          </button>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* ── Regulatory Advisory Notice ── */}
      <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-4 shadow-sm text-amber-950 flex gap-3">
        <div className="text-xl">⚖️</div>
        <div className="text-xs space-y-1">
          <p className="font-bold">Drug Inspector Verification Readiness (Drugs & Cosmetics Rules 65(9))</p>
          <p className="text-amber-900">
            Every dispense of <strong>Schedule H1</strong> (e.g. <em>Augmentin 625, Azithromycin, Cefixime, Alprazolam, Tramadol</em>) and <strong>NDPS/Schedule X</strong> must preserve the Prescribing Doctor's Name & Medical Registration Number, Patient Name & Address, Batch Number, and Dispensing Date for at least <strong>3 years</strong>.
          </p>
        </div>
      </div>

      {/* ── Filters Toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedSchedule}
            onChange={e => setSelectedSchedule(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="">All Controlled Schedules</option>
            <option value="ScheduleH1">Schedule H1 (Restricted Antibiotics & Sedatives)</option>
            <option value="NDPS">NDPS (Narcotics & Opioids)</option>
            <option value="ScheduleX">Schedule X (Strict Psychotropics)</option>
            <option value="ScheduleH">Schedule H (Standard Rx)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded border border-slate-300"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded border border-slate-300"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Total Logged Entries: <strong className="text-slate-900 font-bold">{records.length}</strong>
        </div>
      </div>

      {/* ── Register Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3">Drug & Batch</th>
                <th className="py-3 px-2 text-center">Qty</th>
                <th className="py-3 px-4">Patient Details</th>
                <th className="py-3 px-4">Prescribing Doctor (Reg #)</th>
                <th className="py-3 px-3">Dispensed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <span className="spinner spinner-md" /> Loading statutory register…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No Schedule H1 / NDPS records found for the selected timeframe.
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600 text-[11px]">
                      {new Date(r.dispensedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        {r.scheduleClass}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{r.drugName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">Batch: {r.batchNumber}</div>
                    </td>

                    <td className="py-3 px-2 text-center font-bold text-slate-900">
                      {r.quantity}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{r.patientName}</div>
                      <div className="text-[10px] text-slate-400">{r.patientAddress}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{r.prescriberName}</div>
                      <div className="text-[10px] text-indigo-700 font-mono font-semibold">Reg: {r.prescriberRegNo}</div>
                    </td>

                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {r.dispenserName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
