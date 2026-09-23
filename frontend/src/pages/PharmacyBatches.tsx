import { useState, useEffect } from 'react'
import api from '../services/api'
import { Alert } from '../components/ui/Alert'

interface BatchDetail {
  id: string
  batchNumber: string
  expiryDate: string
  mfgDate?: string
  quantityReceived: number
  quantityRemaining: number
  mrp: number
  purchaseRate: number
  supplierName?: string
  isExpired: boolean
  isNearExpiry: boolean
}

interface DrugMaster {
  id: string
  name: string
  genericName: string
  therapeuticCategory: string
  dosageForm: string
  strength: string
  scheduleClass: string
  hsnCode: string
  gstRate: number
  nlemCovered: boolean
  dpcoCeilingPrice?: number
  standardPackSize: string
  indicativeMrp: number
  commonBrands?: string
  totalStock: number
  activeBatchesCount: number
  expiringBatchesCount: number
  expiredStock: number
  earliestBatch?: {
    batchId: string
    batchNumber: string
    expiryDate: string
    mrp: number
    quantityRemaining: number
  }
}

interface PharmacyStats {
  totalDrugs: number
  todaySales: number
  todayInvoicesCount: number
  expiringSoonBatches: number
  expiredBatches: number
  lowStockCount: number
  scheduleH1Today: number
}

export default function PharmacyBatches() {
  const [drugs, setDrugs] = useState<DrugMaster[]>([])
  const [stats, setStats] = useState<PharmacyStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSchedule, setSelectedSchedule] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [error, setError] = useState('')

  // Inward batch modal
  const [inwardDrug, setInwardDrug] = useState<DrugMaster | null>(null)
  const [inwardBatchNo, setInwardBatchNo] = useState('')
  const [inwardExpiry, setInwardExpiry] = useState('')
  const [inwardMfg, setInwardMfg] = useState('')
  const [inwardQty, setInwardQty] = useState<number | ''>('')
  const [inwardMrp, setInwardMrp] = useState<number | ''>('')
  const [inwardPurchaseRate, setInwardPurchaseRate] = useState<number | ''>('')
  const [inwarding, setInwarding] = useState(false)

  // Drug detail modal
  const [viewDrugDetail, setViewDrugDetail] = useState<any | null>(null)

  const fetchDrugs = async () => {
    setLoading(true)
    setError('')
    try {
      const [drugRes, statsRes] = await Promise.all([
        api.get('/pharmacy/drugs', {
          params: {
            query: searchQuery.trim() || undefined,
            schedule: selectedSchedule || undefined,
            category: selectedCategory || undefined,
            pageSize: 100
          }
        }),
        api.get('/pharmacy/stats')
      ])

      setDrugs(drugRes.data.drugs || [])
      setStats(statsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load medicine catalog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDrugs()
  }, [selectedSchedule, selectedCategory])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchDrugs()
  }

  const exportCatalogCsv = async () => {
    try {
      const response = await api.get('/pharmacy/drugs/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `samstack_medicines_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err) {
      setError('Failed to export catalog CSV')
    }
  }

  const openDrugDetail = async (drugId: string) => {
    setViewDrugDetail(null)
    try {
      const res = await api.get(`/pharmacy/drugs/${drugId}`)
      setViewDrugDetail(res.data)
    } catch (err: any) {
      setError('Failed to load drug batch details')
    }
  }

  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inwardDrug || !inwardBatchNo.trim() || !inwardExpiry || !inwardQty || !inwardMrp) {
      setError('Please fill in all required batch inwarding fields.')
      return
    }

    setInwarding(true)
    setError('')
    try {
      await api.post(`/pharmacy/drugs/${inwardDrug.id}/batches`, {
        batchNumber: inwardBatchNo.trim().toUpperCase(),
        expiryDate: inwardExpiry,
        mfgDate: inwardMfg || undefined,
        quantityReceived: Number(inwardQty),
        mrp: Number(inwardMrp),
        purchaseRate: Number(inwardPurchaseRate || Number(inwardMrp) * 0.7)
      })

      setInwardDrug(null)
      setInwardBatchNo('')
      setInwardExpiry('')
      setInwardMfg('')
      setInwardQty('')
      setInwardMrp('')
      setInwardPurchaseRate('')
      fetchDrugs()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to inward batch stock')
    } finally {
      setInwarding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
              Drug Master & Batches
            </span>
            <span className="text-xs text-slate-500 font-mono">FEFO & Expiry Governance</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">Medicine Catalog & Stock</h1>
          <p className="text-sm text-slate-500">
            DPCO price ceilings, statutory drug schedules, batch expiration tracking, and stock inwarding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCatalogCsv}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs border border-slate-300 rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to Excel / CSV
          </button>
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}

      {/* ── Metrics Cards ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Formulations</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{stats.totalDrugs}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Active medicine master SKUs</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Today's Pharmacy Sales</p>
            <p className="text-2xl font-extrabold text-emerald-700 mt-1">₹{stats.todaySales.toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{stats.todayInvoicesCount} dispensed invoices</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Expiring Soon (60d)</p>
            <p className="text-2xl font-extrabold text-amber-700 mt-1">{stats.expiringSoonBatches}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Batches near expiry</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Schedule H1 / NDPS</p>
            <p className="text-2xl font-extrabold text-purple-700 mt-1">{stats.scheduleH1Today}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Statutory logs captured today</p>
          </div>
        </div>
      )}

      {/* ── Search & Filter Toolbar ── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="flex-1 w-full md:max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by brand, salt (e.g. Paracetamol, Augmentin, Pan 40)..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <div className="absolute left-3 top-2.5 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedSchedule}
            onChange={e => setSelectedSchedule(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="">All Schedules</option>
            <option value="General">General / OTC</option>
            <option value="ScheduleH">Schedule H (Rx)</option>
            <option value="ScheduleH1">Schedule H1 (Controlled Antibiotic)</option>
            <option value="NDPS">NDPS / Schedule X (Narcotics)</option>
          </select>

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 outline-none"
          >
            <option value="">All Categories</option>
            <option value="Antibiotic">Antibiotics</option>
            <option value="Analgesic">Analgesic / Pain</option>
            <option value="Antacid">Antacids / PPI</option>
            <option value="Cardiovascular">Cardiovascular</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="Respiratory">Respiratory</option>
          </select>
        </div>
      </div>

      {/* ── Drug Master Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Medicine & Generic Salt</th>
                <th className="py-3 px-3">Form & Pack</th>
                <th className="py-3 px-3">Schedule</th>
                <th className="py-3 px-3">GST / HSN</th>
                <th className="py-3 px-3">DPCO Ceiling / MRP</th>
                <th className="py-3 px-3">Stock & FEFO Batch</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    <span className="spinner spinner-md" /> Loading medicine inventory…
                  </td>
                </tr>
              ) : drugs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No medicines match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                drugs.map(drug => {
                  const hasStock = drug.totalStock > 0
                  const isH1 = ['ScheduleH1', 'NDPS', 'ScheduleX'].includes(drug.scheduleClass)

                  return (
                    <tr key={drug.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{drug.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {drug.genericName}
                          {drug.commonBrands && <span className="ml-1 text-slate-400">({drug.commonBrands})</span>}
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div>{drug.dosageForm} {drug.strength}</div>
                        <div className="text-[10px] text-slate-400">{drug.standardPackSize}</div>
                      </td>

                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isH1
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : drug.scheduleClass === 'ScheduleH'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {drug.scheduleClass}
                        </span>
                        {drug.nlemCovered && (
                          <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">NLEM 2022</div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{drug.gstRate}%</span>
                        <div className="text-[10px] text-slate-400 font-mono">{drug.hsnCode}</div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">₹{drug.indicativeMrp.toFixed(2)}</div>
                        {drug.dpcoCeilingPrice && (
                          <div className="text-[10px] text-indigo-600 font-medium">
                            DPCO: ₹{drug.dpcoCeilingPrice.toFixed(2)}/unit
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${hasStock ? 'text-emerald-700' : 'text-rose-600'}`}>
                            {drug.totalStock} units
                          </span>
                          {drug.expiringBatchesCount > 0 && (
                            <span className="text-[9px] px-1 bg-amber-100 text-amber-800 rounded font-semibold" title="Expiring soon">
                              ⚠️ {drug.expiringBatchesCount} near exp
                            </span>
                          )}
                        </div>
                        {drug.earliestBatch && (
                          <div className="text-[10px] text-slate-500 font-mono">
                            FEFO: {drug.earliestBatch.batchNumber} (Exp: {drug.earliestBatch.expiryDate})
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1.5">
                        <button
                          onClick={() => openDrugDetail(drug.id)}
                          className="px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold transition"
                        >
                          Batches
                        </button>
                        <button
                          onClick={() => {
                            setInwardDrug(drug)
                            setInwardMrp(drug.indicativeMrp)
                          }}
                          className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-xs font-semibold transition"
                        >
                          + Inward Stock
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inward Stock (GRN) Modal ── */}
      {inwardDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Inward Medicine Stock (GRN)</h3>
                <p className="text-xs text-slate-500">{inwardDrug.name} ({inwardDrug.genericName})</p>
              </div>
              <button onClick={() => setInwardDrug(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <form onSubmit={handleInwardSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 uppercase text-[10px]">Batch Number *</label>
                <input
                  type="text"
                  required
                  value={inwardBatchNo}
                  onChange={e => setInwardBatchNo(e.target.value)}
                  placeholder="e.g. BAT-2026-09"
                  className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300 uppercase font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Expiry Date *</label>
                  <input
                    type="date"
                    required
                    value={inwardExpiry}
                    onChange={e => setInwardExpiry(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Mfg Date</label>
                  <input
                    type="date"
                    value={inwardMfg}
                    onChange={e => setInwardMfg(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Quantity *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={inwardQty}
                    onChange={e => setInwardQty(e.target.value ? parseInt(e.target.value) : '')}
                    placeholder="100"
                    className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Pack MRP (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={inwardMrp}
                    onChange={e => setInwardMrp(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="120.00"
                    className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 uppercase text-[10px]">Purchase Rate (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inwardPurchaseRate}
                    onChange={e => setInwardPurchaseRate(e.target.value ? parseFloat(e.target.value) : '')}
                    placeholder="85.00"
                    className="w-full mt-1 px-3 py-1.5 rounded border border-slate-300"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInwardDrug(null)}
                  className="px-3 py-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inwarding}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold shadow transition"
                >
                  {inwarding ? 'Inwarding…' : 'Save Batch Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Drug Detail & All Batches Modal ── */}
      {viewDrugDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">{viewDrugDetail.name}</h3>
                <p className="text-xs text-slate-500">
                  {viewDrugDetail.genericName} • {viewDrugDetail.dosageForm} {viewDrugDetail.strength} • HSN: {viewDrugDetail.hsnCode}
                </p>
              </div>
              <button onClick={() => setViewDrugDetail(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider">All Batches (FEFO Sorted)</h4>
              {viewDrugDetail.batches?.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">No batches recorded for this medicine.</div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                  {viewDrugDetail.batches?.map((b: BatchDetail) => (
                    <div key={b.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{b.batchNumber}</span>
                          {b.isExpired ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                              EXPIRED
                            </span>
                          ) : b.isNearExpiry ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                              EXPIRING SOON
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 text-[11px] mt-0.5">
                          Exp: {b.expiryDate} {b.mfgDate && `• Mfg: ${b.mfgDate}`} • Supplier: {b.supplierName || 'Primary Distributor'}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-slate-900">{b.quantityRemaining} / {b.quantityReceived} units</div>
                        <div className="text-[11px] text-slate-500">MRP: ₹{b.mrp.toFixed(2)} • Cost: ₹{b.purchaseRate.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewDrugDetail(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
