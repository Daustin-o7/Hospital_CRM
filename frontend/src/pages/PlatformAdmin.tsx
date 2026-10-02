import { useState, useEffect, useCallback } from 'react'
import { EmptyState, SkeletonTableRow } from '../components/ui/EmptyState'
import { friendlyError } from '../components/ui/Alert'
import api from '../services/api'

interface Tenant {
  id: string
  name: string
  subscriptionTier: string
  subscriptionStatus: string
  activatedModules: string[] | null
  createdAt: string
  subscriptionEndsAt: string | null
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PlatformAdmin() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const fetchTenants = useCallback(async (q: string) => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/platform-admin/tenants', { params: q ? { q } : {} })
      setTenants(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounced server-side search (FR-14-01)
  useEffect(() => {
    const t = setTimeout(() => { fetchTenants(query.trim()) }, 350)
    return () => clearTimeout(t)
  }, [query, fetchTenants])

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              SAMSTACK internal
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 14</span>
          </div>
          <h1 className="page-title mt-1">Platform Admin</h1>
          <p className="page-description">
            Tenant list and search — subscription tier, status, and activated modules at a glance.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
          <button onClick={() => fetchTenants(query.trim())} className="btn btn-ghost btn-sm ml-2">Retry</button>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-[var(--color-text-muted)]">
            {loading ? 'Loading tenants…' : `${tenants.length} tenant${tenants.length === 1 ? '' : 's'}`}
          </div>
          <div className="search-wrap">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tenants by name..."
              className="search-input w-64"
              aria-label="Search tenants"
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
                <th>Tenant</th>
                <th>Tier</th>
                <th>Status</th>
                <th>Activated Modules</th>
                <th>Created</th>
                <th>Renews</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonTableRow columns={6} />
                  <SkeletonTableRow columns={6} />
                  <SkeletonTableRow columns={6} />
                </>
              )}

              {!loading && !error && tenants.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      title={query ? 'No Matching Tenants' : 'No Tenants Yet'}
                      description={query
                        ? `Nothing matches “${query}”.`
                        : 'Clinics appear here once they are provisioned on the platform.'}
                    />
                  </td>
                </tr>
              )}

              {!loading && tenants.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className="font-bold text-[var(--color-text)]">{t.name}</div>
                    <div className="mono text-[11px] text-[var(--color-text-muted)]">{t.id.slice(0, 8)}…</div>
                  </td>
                  <td className="capitalize"><span className="badge badge-neutral">{t.subscriptionTier}</span></td>
                  <td>
                    {t.subscriptionStatus === 'active'
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-warning capitalize">{t.subscriptionStatus}</span>}
                  </td>
                  <td>
                    {t.activatedModules && t.activatedModules.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.activatedModules.slice(0, 4).map(m => (
                          <span key={m} className="badge badge-neutral">{m}</span>
                        ))}
                        {t.activatedModules.length > 4 && (
                          <span className="badge badge-neutral">+{t.activatedModules.length - 4}</span>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                  <td className="text-sm">{fmtDate(t.createdAt)}</td>
                  <td className="text-sm">{fmtDate(t.subscriptionEndsAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
