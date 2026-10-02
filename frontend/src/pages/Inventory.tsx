import { useState, useEffect } from 'react'
import { Modal } from '../components/ui/Modal'
import { EmptyState, SkeletonTableRow } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

interface StockItem {
  id: string
  name: string
  tier: 'usable' | 'consumable' | 'dead'
  unit: string
  active: boolean
  lowStockThreshold: number
  balance: number
}

type ItemStatus = 'healthy' | 'low' | 'critical'

function statusOf(item: StockItem): ItemStatus {
  if (item.balance <= 0) return 'critical'
  if (item.lowStockThreshold <= 0) return 'healthy'
  if (item.balance <= Math.max(1, Math.floor(item.lowStockThreshold * 0.3))) return 'critical'
  if (item.balance <= item.lowStockThreshold) return 'low'
  return 'healthy'
}

// ponytail: fixed 50-unit inward pack until supplier/pack-size data exists
const RESTOCK_QTY = 50

export default function Inventory() {
  const { hasRole } = useAuth()
  const canEdit = hasRole(['ClinicAdmin', 'Receptionist'])

  const [items, setItems] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTier, setActiveTier] = useState<'all' | 'consumable' | 'usable' | 'dead'>('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [restockingId, setRestockingId] = useState<string | null>(null)

  // Inward Item form
  const [newItemName, setNewItemName] = useState('')
  const [newItemTier, setNewItemTier] = useState<'consumable' | 'usable' | 'dead'>('consumable')
  const [newItemQty, setNewItemQty] = useState<number | ''>('')
  const [newItemUnit, setNewItemUnit] = useState('pcs')
  const [newItemMin, setNewItemMin] = useState<number | ''>(20)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const fetchItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/inventory/items')
      setItems(res.data)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newItemName.trim() || !newItemQty || saving) return
    setSaving(true)
    try {
      const qty = Number(newItemQty)
      const created = await api.post('/inventory/items', {
        name: newItemName.trim(),
        tier: newItemTier,
        unit: newItemUnit.trim() || 'pcs',
        lowStockThreshold: Number(newItemMin) || 0,
      })
      if (qty > 0) {
        await api.post(`/inventory/items/${created.data.id}/movements`, {
          quantity: qty,
          direction: 'in',
          note: 'Initial inward',
        })
      }
      showToast(`Added ${newItemName.trim()} (${qty} ${newItemUnit}) to inventory.`)
      setModalOpen(false)
      setNewItemName('')
      setNewItemQty('')
      setNewItemUnit('pcs')
      setNewItemMin(20)
      await fetchItems()
    } catch (err) {
      showToast(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleRestock = async (item: StockItem) => {
    if (restockingId) return
    setRestockingId(item.id)
    try {
      const res = await api.post(`/inventory/items/${item.id}/movements`, {
        quantity: RESTOCK_QTY,
        direction: 'in',
        note: 'Restock inward',
      })
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, balance: res.data.balanceAfter } : i))
      showToast(`Inwarded ${RESTOCK_QTY} ${item.unit} for ${item.name}.`)
    } catch (err) {
      showToast(friendlyError(err))
    } finally {
      setRestockingId(null)
    }
  }

  const filteredItems = items
    .filter(item => activeTier === 'all' || item.tier === activeTier)
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))

  const alerts = items.filter(i => statusOf(i) !== 'healthy')
  const lowStockCount = alerts.length

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

        {canEdit && (
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
          <button onClick={fetchItems} className="btn btn-ghost btn-sm ml-2">Retry</button>
        </div>
      )}

      {/* ── Low Stock Critical Alerts Banner ── */}
      {!loading && !error && alerts.length > 0 && (
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
            {alerts.map(item => {
              const status = statusOf(item)
              return (
                <div
                  key={item.id}
                  className={`alert justify-between items-center ${status === 'critical' ? 'alert-error' : 'alert-warning'}`}
                >
                  <div>
                    <div className="text-xs font-bold">{item.name}</div>
                    <div className="text-[11px] mt-0.5">
                      Min threshold: {item.lowStockThreshold} {item.unit}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold">{item.balance} {item.unit}</span>
                    <div className="text-[10px] font-bold mt-0.5">
                      {item.lowStockThreshold > 0
                        ? `${Math.max(0, Math.round((item.balance / item.lowStockThreshold) * 100))}% remaining`
                        : '—'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
                <th>Item Name</th>
                <th>Tier</th>
                <th>Stock Level & Threshold</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonTableRow columns={5} />
                  <SkeletonTableRow columns={5} />
                  <SkeletonTableRow columns={5} />
                  <SkeletonTableRow columns={5} />
                </>
              )}

              {!loading && !error && filteredItems.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-0">
                    <EmptyState
                      title={items.length === 0 ? 'No Inventory Items Yet' : 'No Matching Items'}
                      description={items.length === 0
                        ? 'Catalog your first consumable or equipment so staff can log stock movements against it.'
                        : 'No items match your current filter or search.'}
                      action={items.length === 0 && canEdit ? {
                        label: '+ Inward First Item',
                        onClick: () => setModalOpen(true),
                        variant: 'primary'
                      } : undefined}
                    />
                  </td>
                </tr>
              )}

              {!loading && filteredItems.map(item => {
                const status = statusOf(item)
                const pct = item.lowStockThreshold > 0
                  ? Math.min(100, Math.round((item.balance / (item.lowStockThreshold * 1.5 || 10)) * 100))
                  : Math.min(100, Math.max(0, item.balance * 2))
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="font-bold text-[var(--color-text)]">{item.name}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">{item.unit}</div>
                    </td>
                    <td className="capitalize">
                      <span className="badge badge-neutral">
                        {item.tier}
                      </span>
                    </td>
                    <td>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="mono font-bold text-[var(--color-text)]">
                            {item.balance} {item.unit}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">Min: {item.lowStockThreshold}</span>
                        </div>
                        <div className="w-36 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full rounded-full transition-all ${
                              status === 'critical'
                                ? 'bg-[var(--color-danger)]'
                                : status === 'low'
                                ? 'bg-[var(--color-warning)]'
                                : 'bg-[var(--brand-primary)]'
                            }`}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      {status === 'healthy' && (
                        <span className="badge badge-success">
                          Sufficient Stock
                        </span>
                      )}
                      {status === 'low' && (
                        <span className="badge badge-warning">
                          Low Stock
                        </span>
                      )}
                      {status === 'critical' && (
                        <span className="badge badge-danger">
                          Restock Now
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      {canEdit && (
                        <button
                          onClick={() => handleRestock(item)}
                          disabled={restockingId !== null}
                          className="btn btn-secondary btn-sm cursor-pointer"
                        >
                          {restockingId === item.id
                            ? 'Inwarding…'
                            : `+ Inward (+${RESTOCK_QTY})`}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Inward Stock Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Inward Medical Supply Item"
        description="Record consumable or equipment shipment to inventory"
        size="md"
      >
        <form onSubmit={handleAddStock} className="space-y-4">
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
                min={0}
                value={newItemMin}
                onChange={(e) => setNewItemMin(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="20"
                className="form-input mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="spinner spinner-sm" />
                  Saving…
                </>
              ) : (
                'Confirm Inward Entry'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
