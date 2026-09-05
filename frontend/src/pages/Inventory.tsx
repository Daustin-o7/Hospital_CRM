import { useState } from 'react'

interface StockItem {
  id: string
  name: string
  category: string
  tier: 'usable' | 'consumable' | 'dead'
  currentStock: number
  unit: string
  minThreshold: number
  reorderPack: number
  supplier: string
  status: 'healthy' | 'low' | 'critical'
}

export default function Inventory() {
  const [items, setItems] = useState<StockItem[]>([
    { id: '1', name: 'Latex Examination Gloves (M)', category: 'Consumables', tier: 'consumable', currentStock: 12, unit: 'pairs', minThreshold: 50, reorderPack: 100, supplier: 'MedPlus Surgicals', status: 'critical' },
    { id: '2', name: 'Disposable Syringes 5ml (Luer Lock)', category: 'Consumables', tier: 'consumable', currentStock: 18, unit: 'pcs', minThreshold: 60, reorderPack: 100, supplier: 'Hindustan Syringes', status: 'critical' },
    { id: '3', name: 'Paracetamol 500mg Tablets (Calpol)', category: 'Pharmacy', tier: 'usable', currentStock: 24, unit: 'strips', minThreshold: 40, reorderPack: 50, supplier: 'GSK Pharma Dist', status: 'low' },
    { id: '4', name: 'Amoxicillin 500mg Capsules', category: 'Pharmacy', tier: 'usable', currentStock: 120, unit: 'strips', minThreshold: 30, reorderPack: 50, supplier: 'Cipla Supply', status: 'healthy' },
    { id: '5', name: 'Digital Blood Pressure Monitor (Omron)', category: 'Equipment', tier: 'usable', currentStock: 4, unit: 'units', minThreshold: 2, reorderPack: 5, supplier: 'Omron Healthcare', status: 'healthy' },
    { id: '6', name: 'Expired Bio-Test Reagent Vials', category: 'Lab Supplies', tier: 'dead', currentStock: 8, unit: 'vials', minThreshold: 0, reorderPack: 0, supplier: 'BioRad India', status: 'critical' },
  ])

  const [activeTier, setActiveTier] = useState<'all' | 'consumable' | 'usable' | 'dead'>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // Inward Item state
  const [newItemName, setNewItemName] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('Consumables')
  const [newItemTier, setNewItemTier] = useState<'consumable' | 'usable' | 'dead'>('consumable')
  const [newItemQty, setNewItemQty] = useState<number | ''>('')
  const [newItemUnit, setNewItemUnit] = useState('pcs')
  const [newItemMin, setNewItemMin] = useState<number | ''>(20)
  const [newItemSupplier, setNewItemSupplier] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const handleAddStock = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || !newItemQty) return

    const qty = Number(newItemQty)
    const min = Number(newItemMin) || 10
    const status: StockItem['status'] = qty <= min * 0.3 ? 'critical' : qty <= min ? 'low' : 'healthy'

    const newItem: StockItem = {
      id: String(Date.now()),
      name: newItemName.trim(),
      category: newItemCategory,
      tier: newItemTier,
      currentStock: qty,
      unit: newItemUnit,
      minThreshold: min,
      reorderPack: 50,
      supplier: newItemSupplier.trim() || 'Direct Vendor',
      status
    }

    setItems(prev => [newItem, ...prev])
    showToast(`Added ${newItem.name} (${qty} ${newItem.unit}) to inventory.`)
    setModalOpen(false)
    setNewItemName('')
    setNewItemQty('')
    setNewItemSupplier('')
  }

  const handleRestock = (item: StockItem) => {
    setItems(prev => prev.map(i => {
      if (i.id === item.id) {
        const added = i.reorderPack || 50
        const updated = i.currentStock + added
        return {
          ...i,
          currentStock: updated,
          status: updated > i.minThreshold ? 'healthy' : 'low'
        }
      }
      return i
    }))
    showToast(`Inwarded restock shipment of ${item.reorderPack} ${item.unit} for ${item.name}.`)
  }

  const filteredItems = items
    .filter(item => activeTier === 'all' || item.tier === activeTier)
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase()))

  const lowStockCount = items.filter(i => i.status === 'low' || i.status === 'critical').length

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              3-Tier Clinic Stock Tracking
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 09</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading mt-1">
            Clinical Inventory & Medical Consumables
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Automated reorder thresholds, batch inwarding, and dead stock quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Inward Stock Item</span>
          </button>
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

      {/* ── Low Stock Critical Alerts Banner ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-900 font-heading uppercase tracking-wider">
              Critical Reorder Alerts ({lowStockCount} items below threshold)
            </h2>
          </div>
          <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            Immediate Restock Mandated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Latex Examination Gloves (M)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 50 pairs • Supplier: MedPlus</div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-rose-700 font-mono">12 pairs</span>
              <div className="text-[10px] text-rose-600 font-bold">24% remaining</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Disposable Syringes 5ml</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 60 pcs • Supplier: Hindustan</div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-rose-700 font-mono">18 pcs</span>
              <div className="text-[10px] text-rose-600 font-bold">30% remaining</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Paracetamol 500mg (Calpol)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 40 strips • Supplier: GSK</div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-amber-800 font-mono">24 strips</span>
              <div className="text-[10px] text-amber-700 font-bold">60% remaining</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs & Inventory Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {[
              { id: 'all', label: 'All Items', count: items.length },
              { id: 'consumable', label: 'Consumables', count: items.filter(i => i.tier === 'consumable').length },
              { id: 'usable', label: 'Usable Stock', count: items.filter(i => i.tier === 'usable').length },
              { id: 'dead', label: 'Dead / Expired', count: items.filter(i => i.tier === 'dead').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTier(tab.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTier === tab.id ? 'bg-white text-teal-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTier === tab.id ? 'bg-teal-50 text-teal-700' : 'bg-slate-200/80 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medical supplies..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all w-64"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Item Name & Supplier</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Tier</th>
                <th className="py-3 px-3">Stock Level & Threshold</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredItems.map(item => {
                const pct = Math.min(100, Math.round((item.currentStock / (item.minThreshold * 1.5 || 10)) * 100))
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400">Supplier: {item.supplier}</div>
                    </td>
                    <td className="py-3.5 px-3 text-slate-600">{item.category}</td>
                    <td className="py-3.5 px-3 capitalize">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {item.tier}
                      </span>
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-slate-900">
                            {item.currentStock} {item.unit}
                          </span>
                          <span className="text-[10px] text-slate-400">Min: {item.minThreshold}</span>
                        </div>
                        <div className="w-36 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              item.status === 'critical'
                                ? 'bg-rose-500'
                                : item.status === 'low'
                                ? 'bg-amber-500'
                                : 'bg-teal-600'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3">
                      {item.status === 'healthy' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                          Sufficient Stock
                        </span>
                      )}
                      {item.status === 'low' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Low Stock
                        </span>
                      )}
                      {item.status === 'critical' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          Restock Now
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => handleRestock(item)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200/80 transition cursor-pointer"
                      >
                        + Inward (+{item.reorderPack || 50})
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inward Stock Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-heading">
                Inward Medical Supply Item
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Surgical Gauze 10x10cm"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="Consumables">Consumables</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Lab Supplies">Lab Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Stock Tier
                  </label>
                  <select
                    value={newItemTier}
                    onChange={(e) => setNewItemTier(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  >
                    <option value="consumable">Consumable</option>
                    <option value="usable">Usable Asset</option>
                    <option value="dead">Dead / Quarantined</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Inward Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="100"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs / pairs / vials"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newItemMin}
                    onChange={(e) => setNewItemMin(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="20"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  value={newItemSupplier}
                  onChange={(e) => setNewItemSupplier(e.target.value)}
                  placeholder="e.g. MedPlus Surgicals Corp"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-xs cursor-pointer"
                >
                  Confirm Inward Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
