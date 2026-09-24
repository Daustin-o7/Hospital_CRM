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
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              3-Tier Clinic Stock Tracking
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 09</span>
          </div>
          <h1 className="page-title mt-1">
            Clinical Inventory & Medical Consumables
          </h1>
          <p className="page-description">
            Automated reorder thresholds, batch inwarding, and dead stock quarantine.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-primary cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>+ Inward Stock Item</span>
          </button>
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

      {/* ── Low Stock Critical Alerts Banner ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="section-title mb-0">
              Critical Reorder Alerts ({lowStockCount} items below threshold)
            </h2>
          </div>
          <span className="badge badge-danger">
            Immediate Restock Mandated
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {items.filter(i => i.status !== 'healthy').map(item => (
            <div
              key={item.id}
              className={`alert justify-between items-center ${item.status === 'critical' ? 'alert-error' : 'alert-warning'}`}
            >
              <div>
                <div className="text-xs font-bold">{item.name}</div>
                <div className="text-[11px] mt-0.5">
                  Min threshold: {item.minThreshold} {item.unit} • Supplier: {item.supplier}
                </div>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold">{item.currentStock} {item.unit}</span>
                <div className="text-[10px] font-bold mt-0.5">
                  {item.minThreshold > 0 ? `${Math.round((item.currentStock / item.minThreshold) * 100)}% remaining` : '—'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter Tabs & Inventory Table ── */}
      <div className="card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="tabs mb-0">
            {[
              { id: 'all', label: 'All Items', count: items.length },
              { id: 'consumable', label: 'Consumables', count: items.filter(i => i.tier === 'consumable').length },
              { id: 'usable', label: 'Usable Stock', count: items.filter(i => i.tier === 'usable').length },
              { id: 'dead', label: 'Dead / Expired', count: items.filter(i => i.tier === 'dead').length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTier(tab.id as any)}
                className={`tab ${activeTier === tab.id ? 'active' : ''} flex items-center gap-1.5 cursor-pointer`}
              >
                <span>{tab.label}</span>
                <span className={`badge ${activeTier === tab.id ? 'badge-brand' : 'badge-neutral'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="search-wrap">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medical supplies..."
              className="search-input w-64"
            />
            <svg className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Item Name & Supplier</th>
                <th>Category</th>
                <th>Tier</th>
                <th>Stock Level & Threshold</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const pct = Math.min(100, Math.round((item.currentStock / (item.minThreshold * 1.5 || 10)) * 100))
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-bold text-[var(--color-text)]">{item.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">Supplier: {item.supplier}</div>
                    </td>
                    <td className="text-[var(--color-text-secondary)]">{item.category}</td>
                    <td className="capitalize">
                      <span className="badge badge-neutral">
                        {item.tier}
                      </span>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="mono font-bold text-[var(--color-text)]">
                            {item.currentStock} {item.unit}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Min: {item.minThreshold}</span>
                        </div>
                        <div className="w-36 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              item.status === 'critical'
                                ? 'bg-[var(--color-danger)]'
                                : item.status === 'low'
                                ? 'bg-[var(--color-warning)]'
                                : 'bg-[var(--brand-primary)]'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      {item.status === 'healthy' && (
                        <span className="badge badge-success">
                          Sufficient Stock
                        </span>
                      )}
                      {item.status === 'low' && (
                        <span className="badge badge-warning">
                          Low Stock
                        </span>
                      )}
                      {item.status === 'critical' && (
                        <span className="badge badge-danger">
                          Restock Now
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => handleRestock(item)}
                        className="btn btn-secondary btn-sm cursor-pointer"
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
          <div className="card max-w-lg w-full p-6 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <h3 className="text-base font-bold text-[var(--color-text)] font-heading">
                Inward Medical Supply Item
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="btn btn-ghost btn-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddStock} className="space-y-3">
              <div>
                <label className="form-label">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Surgical Gauze 10x10cm"
                  className="form-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">
                    Category
                  </label>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="Consumables">Consumables</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Lab Supplies">Lab Supplies</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">
                    Stock Tier
                  </label>
                  <select
                    value={newItemTier}
                    onChange={(e) => setNewItemTier(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="consumable">Consumable</option>
                    <option value="usable">Usable Asset</option>
                    <option value="dead">Dead / Quarantined</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">
                    Inward Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="100"
                    className="form-input mono"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    placeholder="pcs / pairs / vials"
                    className="form-input"
                  />
                </div>

                <div>
                  <label className="form-label">
                    Min Threshold
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newItemMin}
                    onChange={(e) => setNewItemMin(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="20"
                    className="form-input mono"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">
                  Supplier / Vendor Name
                </label>
                <input
                  type="text"
                  value={newItemSupplier}
                  onChange={(e) => setNewItemSupplier(e.target.value)}
                  placeholder="e.g. MedPlus Surgicals Corp"
                  className="form-input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary cursor-pointer"
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
