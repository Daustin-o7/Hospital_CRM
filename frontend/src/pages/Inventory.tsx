import { useState } from 'react'

interface StockItem {
  id: string
  name: string
  category: string
  tier: 'usable' | 'consumable' | 'dead'
  currentStock: number
  unit: string
  minThreshold: number
  status: 'healthy' | 'low' | 'critical'
}

export default function Inventory() {
  const [items] = useState<StockItem[]>([

    { id: '1', name: 'Latex Examination Gloves (M)', category: 'Consumables', tier: 'consumable', currentStock: 12, unit: 'pairs', minThreshold: 50, status: 'critical' },
    { id: '2', name: 'Disposable Syringes 5ml', category: 'Consumables', tier: 'consumable', currentStock: 18, unit: 'pcs', minThreshold: 60, status: 'critical' },
    { id: '3', name: 'Paracetamol 500mg Tablets', category: 'Pharmacy', tier: 'usable', currentStock: 24, unit: 'strips', minThreshold: 40, status: 'low' },
    { id: '4', name: 'Amoxicillin 500mg Capsules', category: 'Pharmacy', tier: 'usable', currentStock: 120, unit: 'strips', minThreshold: 30, status: 'healthy' },
    { id: '5', name: 'Digital Blood Pressure Monitor', category: 'Equipment', tier: 'usable', currentStock: 4, unit: 'units', minThreshold: 2, status: 'healthy' },
    { id: '6', name: 'Expired Test Reagent Vials', category: 'Lab Supplies', tier: 'dead', currentStock: 8, unit: 'vials', minThreshold: 0, status: 'critical' },
  ])

  const [activeTier, setActiveTier] = useState<'all' | 'consumable' | 'usable' | 'dead'>('all')
  const [search, setSearch] = useState('')

  const filteredItems = items
    .filter(item => activeTier === 'all' || item.tier === activeTier)
    .filter(item => item.name.toLowerCase().includes(search.toLowerCase()) || item.category.toLowerCase().includes(search.toLowerCase()))

  const lowStockCount = items.filter(i => i.status === 'low' || i.status === 'critical').length

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Inventory & Stock Management</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Module 09 — 3-tier stock tracking (usable, consumable, dead) with auto-reorder alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20">
            + Add Stock Item
          </button>
        </div>
      </div>

      {/* ── Low Stock Alerts Row (Module 09 from design board) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Low Stock Alerts ({lowStockCount} items requiring restock)
            </h2>
          </div>
          <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
            Immediate Action Required
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Gloves (M)</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 50 pairs</div>
            </div>
            <span className="text-lg font-black text-rose-700">12 pairs</span>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Syringes 5ml</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 60 pcs</div>
            </div>
            <span className="text-lg font-black text-rose-700">18 pcs</span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/60 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-900">Paracetamol 500mg</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Min threshold: 40 strips</div>
            </div>
            <span className="text-lg font-black text-amber-700">24 strips</span>
          </div>
        </div>
      </div>

      {/* ── Filter Tabs & Inventory Table ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            {(['all', 'consumable', 'usable', 'dead'] as const).map(tier => (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                  activeTier === tier ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tier === 'all' ? 'All Items' : `${tier} Stock`}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory items..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3">Item Name</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Stock Tier</th>
                <th className="py-2.5 px-3">Current Stock</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-3 font-bold text-slate-900">{item.name}</td>
                  <td className="py-3 px-3 text-slate-500">{item.category}</td>
                  <td className="py-3 px-3 capitalize">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      {item.tier}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="py-3 px-3">
                    {item.status === 'healthy' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        In Stock
                      </span>
                    )}
                    {item.status === 'low' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        Low Stock
                      </span>
                    )}
                    {item.status === 'critical' && (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Restock Now
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">
                      Reorder
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
