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
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              Statutory ITR & GSTR-1 Ready
            </span>
            <span className="text-xs text-slate-400 font-mono">Module 11 & 14</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-heading mt-1">
            Financial Analytics & Tax Audit Reports
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Presumptive Section 44ADA taxation, GSTR-1 GST reconciliation, and multi-tenant telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="August 2026">August 2026 (Current)</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
            <option value="FY 2026-27">FY 2026-27 YTD</option>
          </select>
          <button
            onClick={() => exportReport('ITR-4 CSV')}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export ITR-4 CSV</span>
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

      {/* ── Financial Performance 4 KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Collections</span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              ↑ 14% MoM
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono font-heading">₹{grossIncome.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Consultation + Pharmacy sales</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Operating Expenses</span>
            <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
              12.6% of Rev
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono font-heading">₹{expenses.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">Consumables, utility & staff</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">GST Output Tax (18%)</span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              GSTR-1 Table 4
            </span>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono font-heading">₹{gstLiability.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">CGST ₹41,400 + SGST ₹41,400</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Operating Surplus</span>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              Healthy Margin
            </span>
          </div>
          <div className="text-2xl font-extrabold text-teal-700 mt-2 font-mono font-heading">₹{netProfit.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-400 mt-1">72.1% net clinic profit</p>
        </div>
      </div>

      {/* ── Section 44ADA & Payment Collections Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Section 44ADA Tax Card (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Section 44ADA Presumptive Tax Scheme</h2>
              <p className="text-[11px] text-slate-400">Income Tax Act presumptive provision for medical practitioners</p>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
              ITR-4 Compliant
            </span>
          </div>

          <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-200/60 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold">Total Gross Professional Receipts:</span>
              <span className="font-mono font-bold text-slate-900">₹{grossIncome.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold">Presumptive Income Rate:</span>
              <span className="font-bold text-purple-800">50% Minimum Deemed Profit</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-200/80">
              <span className="font-bold text-slate-900">Deemed Taxable Professional Profit:</span>
              <span className="font-mono font-black text-purple-900 text-base">₹{deemedIncome44ADA.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Medical practitioners earning under ₹75 Lakhs annually (with ≤ 5% cash receipts) are exempt from maintaining formal books under Section 44AA.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => exportReport('ITR-4 CSV')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              Export ITR-4 Computation CSV
            </button>
            <button
              onClick={() => exportReport('GSTR-1 JSON')}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
            >
              GSTR-1 Portal JSON
            </button>
          </div>
        </div>

        {/* Payment Channels & Distribution (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Payment Channel Distribution</h2>
              <p className="text-[11px] text-slate-400">Cash vs UPI digital settlement telemetry</p>
            </div>
            <span className="text-xs font-bold text-teal-700">88% Digital</span>
          </div>

          <div className="space-y-3.5">
            {/* UPI */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800">UPI (Razorpay Dynamic QR & Static Soundbox)</span>
                <span className="font-mono font-bold text-slate-900">₹3,84,200 (70.8%)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="w-[70.8%] h-full bg-teal-600 rounded-full"></div>
              </div>
            </div>

            {/* Debit/Credit Cards */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800">Card & NetBanking POS</span>
                <span className="font-mono font-bold text-slate-900">₹94,600 (17.4%)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="w-[17.4%] h-full bg-blue-600 rounded-full"></div>
              </div>
            </div>

            {/* Cash */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-slate-800">Counter Cash (Form 60 Tracked)</span>
                <span className="font-mono font-bold text-slate-900">₹64,000 (11.8%)</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="w-[11.8%] h-full bg-amber-500 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 flex items-center gap-2">
            <span className="text-base">🛡️</span>
            <span>All UPI collections auto-reconciled against Razorpay Webhook signatures within 2.4 seconds.</span>
          </div>
        </div>
      </div>

      {/* ── Platform Admin Overview Card ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight font-heading">Multi-Tenant Platform Health</h2>
            <p className="text-[11px] text-slate-400">Module 14 — Cross-tenant telemetry and database uptime</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse"></span> All Systems Operational
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Clinics</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono font-heading">32</div>
            <span className="text-[11px] text-slate-400">Isolated database tenants</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Staff & Doctors</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono font-heading">156</div>
            <span className="text-[11px] text-teal-700 font-semibold">Verified Entra ID Sessions</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Monthly Consultations</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1 font-mono font-heading">14,820</div>
            <span className="text-[11px] text-slate-400">Past 30 days throughput</span>
          </div>
        </div>
      </div>
    </div>
  )
}
