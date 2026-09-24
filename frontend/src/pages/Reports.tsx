import { useState } from 'react'

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState('August 2026')
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const exportReport = (format: 'ITR-4 CSV' | 'GSTR-1 JSON' | 'Audit PDF') => {
    showToast(`Generating and exporting ${format} for ${selectedMonth}…`)
  }

  // Financial Metrics
  const grossIncome = 542800
  const expenses = 68450
  const gstLiability = 82800
  const netProfit = grossIncome - expenses - gstLiability
  
  // Section 44ADA Presumptive Taxation (50% deemed profit for medical professionals)
  const deemedIncome44ADA = Math.round(grossIncome * 0.5)

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      <div className="alert alert-warning">
        <strong>Sample data.</strong> Figures on this page are illustrative — the Reports API is not
        implemented yet, so nothing here is loaded from your clinic's records.
      </div>
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
            className="form-select text-xs py-1.5"
          >
            <option value="August 2026">August 2026 (Current)</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
            <option value="FY 2026-27">FY 2026-27 YTD</option>
          </select>
          <button
            onClick={() => exportReport('ITR-4 CSV')}
            className="btn btn-primary btn-sm cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export ITR-4 CSV</span>
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

      {/* ── Financial Performance 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Gross Collections</span>
            <span className="badge badge-success">
              ↑ 14% MoM
            </span>
          </div>
          <div className="stat-value mt-2 font-mono font-heading">₹{grossIncome.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Consultation + Pharmacy sales</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Operating Expenses</span>
            <span className="badge badge-neutral">
              12.6% of Rev
            </span>
          </div>
          <div className="stat-value mt-2 font-mono font-heading">₹{expenses.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Consumables, utility & staff</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">GST Output Tax (18%)</span>
            <span className="badge badge-info">
              GSTR-1 Table 4
            </span>
          </div>
          <div className="stat-value mt-2 font-mono font-heading">₹{gstLiability.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">CGST ₹41,400 + SGST ₹41,400</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Net Operating Surplus</span>
            <span className="badge badge-brand">
              Healthy Margin
            </span>
          </div>
          <div className="stat-value mt-2 font-mono font-heading">₹{netProfit.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">72.1% net clinic profit</p>
        </div>
      </div>

      {/* ── Section 44ADA & Payment Collections Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section 44ADA Tax Card (6 cols) */}
        <div className="lg:col-span-6 card p-5 space-y-4">
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">Section 44ADA Presumptive Tax Scheme</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Income Tax Act presumptive provision for medical practitioners</p>
            </div>
            <span className="badge badge-info">
              ITR-4 Compliant
            </span>
          </div>

          <div className="card p-4 space-y-3" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)]">Total Gross Professional Receipts:</span>
              <span className="mono font-bold text-[var(--color-text)]">₹{grossIncome.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--color-text-secondary)]">Presumptive Income Rate:</span>
              <span className="font-bold text-[var(--brand-primary)]">50% Minimum Deemed Profit</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <span className="font-bold text-[var(--color-text)]">Deemed Taxable Professional Profit:</span>
              <span className="mono font-black text-base text-[var(--brand-secondary)]">₹{deemedIncome44ADA.toLocaleString('en-IN')}</span>
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
              <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">Payment Channel Distribution</h2>
              <p className="text-[11px] text-[var(--color-text-muted)]">Cash vs UPI digital settlement telemetry</p>
            </div>
            <span className="badge badge-brand">88% Digital</span>
          </div>

          <div className="space-y-3.5">
            {/* UPI */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[var(--color-text)]">UPI (Razorpay Dynamic QR & Static Soundbox)</span>
                <span className="mono font-bold text-[var(--color-text)]">₹3,84,200 (70.8%)</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="w-[70.8%] h-full bg-[var(--brand-primary)] rounded-full"></div>
              </div>
            </div>

            {/* Debit/Credit Cards */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[var(--color-text)]">Card & NetBanking POS</span>
                <span className="mono font-bold text-[var(--color-text)]">₹94,600 (17.4%)</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="w-[17.4%] h-full bg-blue-500 rounded-full"></div>
              </div>
            </div>

            {/* Cash */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[var(--color-text)]">Counter Cash (Form 60 Tracked)</span>
                <span className="mono font-bold text-[var(--color-text)]">₹64,000 (11.8%)</span>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-raised)' }}>
                <div className="w-[11.8%] h-full bg-amber-500 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="alert alert-info items-center">
            <span className="text-base">🛡️</span>
            <span>All UPI payments are verified against Razorpay webhook signatures.</span>
          </div>
        </div>
      </div>

      {/* ── Platform Admin Overview Card ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h2 className="text-sm font-bold tracking-tight font-heading text-[var(--color-text)]">Multi-Tenant Platform Health</h2>
            <p className="text-[11px] text-[var(--color-text-muted)]">Module 14 — Cross-tenant telemetry and database uptime</p>
          </div>
          <span className="badge badge-brand">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span> Telemetry Pending
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <span className="stat-label">Active Clinics</span>
            <div className="stat-value mt-1 mono font-heading">—</div>
            <span className="text-[11px] text-[var(--color-text-muted)]">Reports API pending</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Active Staff & Doctors</span>
            <div className="stat-value mt-1 mono font-heading">—</div>
            <span className="text-[11px] text-[var(--color-text-muted)]">Reports API pending</span>
          </div>

          <div className="stat-card">
            <span className="stat-label">Monthly Consultations</span>
            <div className="stat-value mt-1 mono font-heading">—</div>
            <span className="text-[11px] text-[var(--color-text-muted)]">Reports API pending</span>
          </div>
        </div>
      </div>
    </div>
  )
}
