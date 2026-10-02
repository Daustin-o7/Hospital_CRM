import { useState, useEffect } from 'react'
import api from '../services/api'
import { friendlyError } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState('August 2026')
  const [toast, setToast] = useState<string | null>(null)
  const [financialData, setFinancialData] = useState<any>(null)
  const [presumptiveData, setPresumptiveData] = useState<any>(null)
  const [paymentDistribution, setPaymentDistribution] = useState<any>(null)
  const [platformHealth, setPlatformHealth] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const exportReport = (format: 'ITR-4 CSV' | 'GSTR-1 JSON' | 'Audit PDF') => {
    showToast(`Generating and exporting ${format} for ${selectedMonth}…`)
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch all reports data in parallel
      const [financialRes, presumptiveRes, paymentRes, healthRes] = await Promise.all([
        api.get(`/reports/financial?month=${selectedMonth}`),
        api.get(`/reports/itr4?month=${selectedMonth}`),
        api.get(`/reports/payment-distribution?month=${selectedMonth}`),
        api.get(`/reports/platform-health?month=${selectedMonth}`)
      ])
      
      setFinancialData(financialRes.data)
      setPresumptiveData(presumptiveRes.data)
      setPaymentDistribution(paymentRes.data)
      setPlatformHealth(healthRes.data)
    } catch (err: any) {
      const message = friendlyError(err)
      setError(message)
      showToast(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [selectedMonth])

  // Helper function to safely access nested data with fallbacks
  const safeGet = (obj: any, path: string, fallback: any = null) => {
    const parts = path.split('.')
    let current = obj
    
    for (const part of parts) {
      if (current === null || current === undefined) return fallback
      current = current[part]
    }
    
    return current !== undefined && current !== null ? current : fallback
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {error && (
        <div className="alert alert-error">
          {error}
          <button
            onClick={() => {
              setError(null)
              fetchData()
            }}
            className="btn btn-ghost btn-sm ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="page-header sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              ITR-4 & GSTR-1 Summaries
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 11 & 14</span>
          </div>
          <h1 className="page-title font-heading mt-1">
            Financial Analytics & Tax Audit Reports
          </h1>
          <p className="page-description">
            Presumptive Section 44ADA taxation, GSTR-1 GST reconciliation, and multi-tenant telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            disabled={loading}
            className="form-select text-xs py-1.5"
          >
            <option value="August 2026">August 2026 (Current)</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
            <option value="FY 2026-27">FY 2026-27 YTD</option>
          </select>
          <button
            onClick={() => exportReport('ITR-4 CSV')}
            disabled={loading}
            className="btn btn-primary btn-sm cursor-pointer"
          >
            {loading ? 'Generating…' : 'Export ITR-4 CSV'}
            <svg className="ml-2 w-3.5 h-3.5 fill-none stroke-currentColor viewBox-[0_0_24_24]">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        </div>
      </div>

      {toast && (
        <div className="alert alert-info">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading && !financialData && !error && (
        <div className="space-y-6">
          {/* Financial Performance 4 KPI Cards Loading */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>

          {/* Section 44ADA & Payment Collections Grid Loading */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 skeleton-card" />
            <div className="lg:col-span-6 skeleton-card" />
          </div>

          {/* Platform Admin Overview Card Loading */}
          <div className="skeleton-card" />
        </div>
      )}

      {/* Empty States when no data */}
      {!loading && !financialData && !presumptiveData && !paymentDistribution && !platformHealth && !error && (
        <div className="space-y-6">
          <EmptyState
            illustration={<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.3"/>
              <path d="M28 36 L40 24 L52 36" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
              <path d="M40 44 L40 56" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
            </svg>}
            title="No Report Data Available"
            description="No financial data found for the selected period. This could be because there are no recorded transactions or the reporting period has no activity."
            action={{
              label: 'Try Different Period',
              onClick: () => setSelectedMonth('July 2026'),
              variant: 'secondary'
            }}
          />
        </div>
      )}

      {/* Financial Performance 4 KPI Cards */}
      {!loading && financialData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Gross Collections</span>
              <span className="badge badge-success">
                {safeGet(financialData, 'grossCollectionsMoMChange', 0) >= 0 ? '↑' : '↓'}
                {Math.abs(safeGet(financialData, 'grossCollectionsMoMChange', 0))}% MoM
              </span>
            </div>
            <div className="stat-value mt-2 font-mono font-heading">
              ₹{safeGet(financialData, 'grossIncome', 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Consultation + Pharmacy sales
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Operating Expenses</span>
              <span className="badge badge-neutral">
                {safeGet(financialData, 'expensesPercentage', 0)}% of Rev
              </span>
            </div>
            <div className="stat-value mt-2 font-mono font-heading">
              ₹{safeGet(financialData, 'totalExpenses', 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Consumables, utility & staff
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">GST Output Tax (18%)</span>
              <span className="badge badge-info">
                GSTR-1 Table 4
              </span>
            </div>
            <div className="stat-value mt-2 font-mono font-heading">
              ₹{safeGet(financialData, 'gstLiability', 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              CGST ₹{Math.round(safeGet(financialData, 'gstLiability', 0) / 2).toLocaleString('en-IN')} + 
              SGST ₹{Math.round(safeGet(financialData, 'gstLiability', 0) / 2).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Net Operating Surplus</span>
              <span className="badge badge-brand">
                {safeGet(financialData, 'netProfitMargin', 0) >= 20 ? 'Healthy Margin' : 'Review Recommended'}
              </span>
            </div>
            <div className="stat-value mt-2 font-mono font-heading">
              ₹{safeGet(financialData, 'netProfit', 0).toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {safeGet(financialData, 'netProfitMargin', 0)}% net clinic profit
            </p>
          </div>
        </div>
      )}

      {/* Section 44ADA & Payment Collections Grid */}
      {!loading && presumptiveData && paymentDistribution && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Section 44ADA Tax Card (6 cols) */}
          <div className="lg:col-span-6 card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">
                  Section 44ADA Presumptive Tax Scheme
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Income Tax Act presumptive provision for medical practitioners
                </p>
              </div>
              <span className="badge badge-info">
                ITR-4 Compliant
              </span>
            </div>

            <div className="card p-4 space-y-3" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-text-secondary)]">Total Gross Professional Receipts:</span>
                <span className="mono font-bold text-[var(--color-text)]">
                  ₹{safeGet(presumptiveData, 'grossProfessionalReceipts', 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--color-text-secondary)]">Presumptive Income Rate:</span>
                <span className="font-bold text-[var(--brand-primary)]">50% Minimum Deemed Profit</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="font-bold text-[var(--color-text)]">Deemed Taxable Professional Profit:</span>
                <span className="mono font-black text-base text-[var(--brand-secondary)]">
                  ₹{safeGet(presumptiveData, 'deemedTaxableProfit', 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
              Medical practitioners earning under ₹75 Lakhs annually (with ≤ 5% cash receipts) are exempt from maintaining formal books under Section 44AA.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => exportReport('ITR-4 CSV')}
                className="btn btn-secondary btn-sm cursor-pointer"
              >
                Export ITR-4 Computation CSV
              </button>
              <button
                onClick={() => exportReport('GSTR-1 JSON')}
                className="btn btn-secondary btn-sm cursor-pointer"
              >
                GSTR-1 Portal JSON
              </button>
            </div>
          </div>

          {/* Payment Channels & Distribution (6 cols) */}
          <div className="lg:col-span-6 card p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">
                  Payment Channel Distribution
                </h2>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Cash vs UPI digital settlement telemetry
                </p>
              </div>
              <span className="badge badge-brand">
                {safeGet(paymentDistribution, 'digitalPaymentPercentage', 0)}% Digital
              </span>
            </div>

            <div className="space-y-3.5">
              {/* UPI */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-[var(--color-text)]">
                    UPI (Razorpay Dynamic QR & Static Soundbox)
                  </span>
                  <span className="mono font-bold text-[var(--color-text)]">
                    ₹{safeGet(paymentDistribution, 'upiAmount', 0).toLocaleString('en-IN')} 
                    ({safeGet(paymentDistribution, 'upiPercentage', 0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                  <div 
                    className="w-full h-full bg-[var(--brand-primary)] rounded-full" 
                    style={{ width: `${safeGet(paymentDistribution, 'upiPercentage', 0)}%` }}
                  />
                </div>
              </div>

              {/* Debit/Credit Cards */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-[var(--color-text)]">Card & NetBanking POS</span>
                  <span className="mono font-bold text-[var(--color-text)]">
                    ₹{safeGet(paymentDistribution, 'cardAmount', 0).toLocaleString('en-IN')} 
                    ({safeGet(paymentDistribution, 'cardPercentage', 0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                  <div 
                    className="w-full h-full bg-blue-500 rounded-full" 
                    style={{ width: `${safeGet(paymentDistribution, 'cardPercentage', 0)}%` }}
                  />
                </div>
              </div>

              {/* Cash */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-[var(--color-text)]">Counter Cash (Form 60 Tracked)</span>
                  <span className="mono font-bold text-[var(--color-text)]">
                    ₹{safeGet(paymentDistribution, 'cashAmount', 0).toLocaleString('en-IN')} 
                    ({safeGet(paymentDistribution, 'cashPercentage', 0)}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                  <div 
                    className="w-full h-full bg-amber-500 rounded-full" 
                    style={{ width: `${safeGet(paymentDistribution, 'cashPercentage', 0)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="alert alert-info items-center">
              <span className="text-base">🛡️</span>
              <span>All UPI payments are verified against Razorpay webhook signatures.</span>
            </div>
          </div>
        </div>
      )}

      {/* Platform Admin Overview Card */}
      {!loading && platformHealth && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">
                Multi-Tenant Platform Health
              </h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Module 14 — Cross-tenant telemetry and database uptime
              </p>
            </div>
            <span className="badge badge-brand">
              <span 
                className="w-2 h-2 rounded-full" 
                style={{ 
                  backgroundColor: safeGet(platformHealth, 'overallStatus') === 'healthy' 
                    ? 'var(--brand-success)' 
                    : safeGet(platformHealth, 'overallStatus') === 'degraded'
                      ? 'var(--brand-warning)' 
                      : 'var(--brand-error)' 
                }}
              ></span>
              {safeGet(platformHealth, 'overallStatus', 'unknown').toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="stat-card">
              <span className="stat-label">Active Clinics</span>
              <div className="stat-value mt-1 mono font-heading">
                {safeGet(platformHealth, 'activeTenants', 0)}
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Reporting clinics
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Active Staff & Doctors</span>
              <div className="stat-value mt-1 mono font-heading">
                {safeGet(platformHealth, 'totalUsers', 0)}
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Providers & staff
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">Monthly Consultations</span>
              <div className="stat-value mt-1 mono font-heading">
                {safeGet(platformHealth, 'monthlyConsultations', 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Patient encounters
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}