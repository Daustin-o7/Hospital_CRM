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

  useEffect(() => {
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
    } catch {
      setError('Failed to export compliance register CSV')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-info">
              CDSCO & NDPS Act Statutory Compliance
            </span>
            <span className="text-xs text-slate-500 font-mono">Form 20/21 Mandated Register</span>
          </div>
          <h1 className="page-title mt-1">Controlled Substance & Schedule H1 Register</h1>
          <p className="page-description">
            Immutable audit record of restricted 3rd/4th generation antibiotics, sedatives, and narcotics per 2013 Gazette notification.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportInspectionCsv}
            className="btn btn-secondary btn-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Drug Inspector CSV
          </button>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* ── Regulatory Advisory Notice ── */}
      <div className="alert alert-warning">
        <div className="text-xl">⚖️</div>
        <div className="text-xs space-y-1">
          <p className="font-bold">Drug Inspector Verification Readiness (Drugs & Cosmetics Rules 65(9))</p>
          <p>
            Every dispense of <strong>Schedule H1</strong> (e.g. <em>Augmentin 625, Azithromycin, Cefixime, Alprazolam, Tramadol</em>) and <strong>NDPS/Schedule X</strong> must preserve the Prescribing Doctor's Name & Medical Registration Number, Patient Name & Address, Batch Number, and Dispensing Date for at least <strong>3 years</strong>.
          </p>
        </div>
      </div>

      {/* ── Filters Toolbar ── */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedSchedule}
            onChange={e => setSelectedSchedule(e.target.value)}
            className="form-select text-xs"
          >
            <option value="">All Controlled Schedules</option>
            <option value="ScheduleH1">Schedule H1 (Restricted Antibiotics & Sedatives)</option>
            <option value="NDPS">NDPS (Narcotics & Opioids)</option>
            <option value="ScheduleX">Schedule X (Strict Psychotropics)</option>
            <option value="ScheduleH">Schedule H (Standard Rx)</option>
          </select>

          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="form-input text-xs py-1.5 w-40"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="form-input text-xs py-1.5 w-40"
            />
          </div>
        </div>

        <div className="text-xs font-medium text-[var(--color-text-muted)]">
          Total Logged Entries: <strong className="font-bold text-[var(--color-text)]">{records.length}</strong>
        </div>
      </div>

      {/* ── Register Table ── */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Schedule</th>
                <th>Drug & Batch</th>
                <th className="text-center">Qty</th>
                <th>Patient Details</th>
                <th>Prescribing Doctor (Reg #)</th>
                <th>Dispensed By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--color-text-muted)]">
                    <span className="spinner" /> Loading statutory register…
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-state-title">No records found</div>
                      <p className="empty-state-description">No Schedule H1 / NDPS records found for the selected timeframe.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map(r => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap mono text-[var(--color-text-secondary)]">
                      {new Date(r.dispensedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td>
                      <span className="badge badge-warning">
                        {r.scheduleClass}
                      </span>
                    </td>

                    <td>
                      <div className="font-bold text-[var(--color-text)]">{r.drugName}</div>
                      <div className="text-[10px] mono text-[var(--color-text-muted)]">Batch: {r.batchNumber}</div>
                    </td>

                    <td className="text-center font-bold text-[var(--color-text)]">
                      {r.quantity}
                    </td>

                    <td>
                      <div className="font-semibold text-[var(--color-text)]">{r.patientName}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{r.patientAddress}</div>
                    </td>

                    <td>
                      <div className="font-semibold text-[var(--color-text)]">{r.prescriberName}</div>
                      <div className="text-[10px] mono font-semibold text-[var(--brand-primary)]">Reg: {r.prescriberRegNo}</div>
                    </td>

                    <td className="font-medium text-[var(--color-text-secondary)]">
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
