import { useState, useEffect, useCallback } from 'react'
import { EmptyState, SkeletonTableRow } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'
import { fmtDate } from '../utils/format'
import api from '../services/api'

interface LabOrder {
  id: string
  consultationId: string | null
  patientId: string | null
  doctorId: string | null
  testName: string
  notes: string | null
  status: 'ordered' | 'completed'
  createdAt: string
  completedAt: string | null
  latestResultVersion: number | null
}

type Tab = 'pending' | 'completed' | 'all'

export default function LabOrders() {
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [patientNames, setPatientNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('pending')

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const [orderRes, patRes] = await Promise.all([
        api.get('/lab-orders'),
        api.get('/patients').catch(() => ({ data: [] })),
      ])
      const list: LabOrder[] = Array.isArray(orderRes.data) ? orderRes.data : []
      setOrders(list)

      const patList = Array.isArray(patRes.data) ? patRes.data : []
      const names = Object.fromEntries(patList.map((p: any) => [p.id, p.name]))
      setPatientNames(names)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const counts = {
    pending: orders.filter(o => o.status === 'ordered').length,
    completed: orders.filter(o => o.status === 'completed').length,
    all: orders.length,
  }
  const visible = tab === 'all' ? orders : orders.filter(o => o.status === tab)

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              Lab Records
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 08</span>
          </div>
          <h1 className="page-title mt-1">Lab Worklist</h1>
          <p className="page-description">
            Pending orders needing follow-up, completed ones for reference.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={fetchOrders} className="btn btn-ghost btn-sm ml-2">Retry</button>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="tabs mb-0">
          {([
            { id: 'pending', label: 'Pending', count: counts.pending },
            { id: 'completed', label: 'Completed', count: counts.completed },
            { id: 'all', label: 'All Orders', count: counts.all },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`tab ${tab === t.id ? 'active' : ''} flex items-center gap-1.5 cursor-pointer`}
            >
              <span>{t.label}</span>
              <span className={`badge ${tab === t.id ? 'badge-brand' : 'badge-neutral'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Patient</th>
                <th>Status</th>
                <th>Ordered</th>
                <th>Completed</th>
                <th className="text-right">Result</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonTableRow columns={6} />
                  <SkeletonTableRow columns={6} />
                  <SkeletonTableRow columns={6} />
                  <SkeletonTableRow columns={6} />
                </>
              )}

              {!loading && !error && visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      title={orders.length === 0 ? 'No Lab Orders Yet' : `No ${tab} Orders`}
                      description={orders.length === 0
                        ? 'Lab orders are created from a consultation. Open a consultation and order a test to see it here.'
                        : 'Nothing in this list right now.'}
                    />
                  </td>
                </tr>
              )}

              {!loading && visible.map(order => (
                <tr key={order.id}>
                  <td>
                    <div className="font-bold text-[var(--color-text)]">{order.testName}</div>
                    {order.notes && (
                      <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[240px]">{order.notes}</div>
                    )}
                  </td>
                  <td>
                    {order.patientId ? (
                      patientNames[order.patientId] ?? <span className="mono text-xs">{order.patientId.slice(0, 8)}…</span>
                    ) : '—'}
                  </td>
                  <td>
                    {order.status === 'completed' ? (
                      <span className="badge badge-success">Completed</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                  <td className="text-sm">{fmtDate(order.createdAt)}</td>
                  <td className="text-sm">{fmtDate(order.completedAt)}</td>
                  <td className="text-right">
                    {order.latestResultVersion ? (
                      <span className="badge badge-neutral mono">v{order.latestResultVersion}</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">—</span>
                    )}
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
