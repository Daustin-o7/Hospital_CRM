import { useState } from 'react'

export default function Reports() {
  const [selectedMonth, setSelectedMonth] = useState('August 2026')

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Analytics & Tax Audit Reports
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Module 11 & 14 — Monthly ITR accounting exports, revenue trends, and platform metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
          >
            <option value="August 2026">August 2026</option>
            <option value="July 2026">July 2026</option>
            <option value="June 2026">June 2026</option>
          </select>
          <button className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export ITR CSV</span>
          </button>
        </div>
      </div>

      {/* ── Financial Performance Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Income</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">₹5,42,800</div>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">↑ 14% vs last month</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expenses</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">₹68,450</div>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">12.6% of revenue</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">GST Liability (18%)</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-2">₹82,800</div>
          <span className="text-[11px] font-semibold text-slate-500 mt-1 block">Ready for GSTR-1</span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Operating Profit</span>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2">₹3,91,550</div>
          <span className="text-[11px] font-semibold text-emerald-600 mt-1 block">Healthy margin</span>
        </div>
      </div>

      {/* ── Platform Admin Overview Card (Design Board Module 14) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Platform Admin & Clinic Health</h2>
            <p className="text-xs text-slate-500">Module 14 — Cross-tenant health and active clinic statistics</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span> System Healthy
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Clinics</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">32</div>
            <span className="text-[11px] text-slate-400">Deployed instances</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-semibold uppercase">Active Doctors & Staff</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">156</div>
            <span className="text-[11px] text-emerald-600 font-semibold">Active today</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-xs text-slate-500 font-semibold uppercase">Total Consultations</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">14,820</div>
            <span className="text-[11px] text-slate-400">Past 30 days</span>
          </div>
        </div>
      </div>
    </div>
  )
}
