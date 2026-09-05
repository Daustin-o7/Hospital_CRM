import { useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const invoiceSchema = z.object({

  patientName: z.string().min(1, 'Patient name is required'),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    amount: z.number().min(1, 'Amount must be positive'),
  })).min(1, 'At least one line item is required'),
})

type InvoiceForm = z.infer<typeof invoiceSchema>

interface Invoice {
  id: string
  invoiceNumber: string
  patientName: string
  subtotal: number
  gst: number
  total: number
  status: 'paid' | 'pending' | 'overdue'
  date: string
}

interface Expense {
  id: string
  category: string
  amount: number
  date: string
  note: string
}

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([

    { id: '1', invoiceNumber: 'INV-2026-001', patientName: 'Ravi Kumar', subtotal: 800, gst: 144, total: 944, status: 'paid', date: 'Today, 10:30 AM' },
    { id: '2', invoiceNumber: 'INV-2026-002', patientName: 'Priya Singh', subtotal: 1500, gst: 270, total: 1770, status: 'paid', date: 'Today, 11:15 AM' },
    { id: '3', invoiceNumber: 'INV-2026-003', patientName: 'Anil Verma', subtotal: 600, gst: 108, total: 708, status: 'pending', date: 'Today, 12:00 PM' },
    { id: '4', invoiceNumber: 'INV-2026-004', patientName: 'Neha Gupta', subtotal: 2500, gst: 450, total: 2950, status: 'overdue', date: 'Yesterday' },
  ])

  const [expenses, setExpenses] = useState<Expense[]>([
    { id: '1', category: 'Medical Supplies', amount: 1450, date: 'Today', note: 'Syringes & sterile gloves' },
    { id: '2', category: 'Utilities', amount: 700, date: 'Today', note: 'Clinic sanitization refills' },
  ])

  const [activeTab, setActiveTab] = useState<'invoices' | 'ledger'>('invoices')
  const [modalOpen, setModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const [expCategory, setExpCategory] = useState('Medical Supplies')
  const [expAmount, setExpAmount] = useState('1000')
  const [expNote, setExpNote] = useState('')

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      patientName: '',
      lineItems: [{ description: 'OPD Consultation Fee', amount: 800 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleCreateInvoice = (data: InvoiceForm) => {
    const sub = data.lineItems.reduce((acc, item) => acc + Number(item.amount || 0), 0)
    const gstAmt = Math.round(sub * 0.18)
    const tot = sub + gstAmt

    const newInv: Invoice = {
      id: String(Date.now()),
      invoiceNumber: `INV-2026-${String(invoices.length + 1).padStart(3, '0')}`,
      patientName: data.patientName,
      subtotal: sub,
      gst: gstAmt,
      total: tot,
      status: 'pending',
      date: 'Just now',
    }

    setInvoices(prev => [newInv, ...prev])
    setModalOpen(false)
    reset()
    showToast(`Invoice ${newInv.invoiceNumber} created.`)
  }

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()
    if (!expAmount || isNaN(Number(expAmount))) return

    const newExp: Expense = {
      id: String(Date.now()),
      category: expCategory,
      amount: Number(expAmount),
      date: 'Today',
      note: expNote || 'Logged expense',
    }

    setExpenses(prev => [newExp, ...prev])
    setExpenseModalOpen(false)
    setExpNote('')
    showToast('Expense recorded to ledger.')
  }

  const handleMarkPaid = (id: string) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'paid' } : inv))
    showToast('Payment recorded as PAID.')
  }

  const totalIncome = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Billing & Finance Ledger
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">
            Manage patient invoices, collections, and clinic daily expenses.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm"
          >
            + Add Expense
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-700/20"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {toast && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* ── Finance Ledger Summary Widget ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
                Daily Revenue & Cash Ledger
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                GSTIN: 27AABCS1429B1ZB
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Real-time collections, invoice aging, and clinic operational expenditure.</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'invoices' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tax Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'ledger' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expense Ledger ({expenses.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Total Collected</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-2xl font-bold text-emerald-950 mt-1" style={{ fontFamily: 'var(--font-heading)' }}>
              ₹{totalIncome.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Includes ₹{Math.round(totalIncome * 0.18 / 1.18)} GST Collected</div>
          </div>
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Daily Expenses</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <div className="text-2xl font-bold text-rose-950 mt-1" style={{ fontFamily: 'var(--font-heading)' }}>
              ₹{totalExpenses.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-rose-700 font-medium mt-0.5">{expenses.length} ledger voucher entries</div>
          </div>
          <div className="p-4 rounded-2xl bg-teal-50/50 border border-teal-200/70">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Net Operating Margin</span>
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            </div>
            <div className="text-2xl font-bold text-teal-950 mt-1" style={{ fontFamily: 'var(--font-heading)' }}>
              ₹{(totalIncome - totalExpenses).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-teal-700 font-medium mt-0.5">Surplus for current calendar day</div>
          </div>
        </div>
      </div>

      {/* ── Table Content ── */}
      {activeTab === 'invoices' ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
              Issued Tax Invoices
            </h3>
            <span className="text-xs text-slate-400 font-medium">Standard HSN / SAC billing rules</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Invoice Number</th>
                  <th className="py-2.5 px-3">Patient Profile</th>
                  <th className="py-2.5 px-3">Taxable Value</th>
                  <th className="py-2.5 px-3">GST (18%)</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{inv.invoiceNumber}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{inv.patientName}</div>
                      <div className="text-[10.5px] text-slate-400">{inv.date}</div>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">₹{inv.subtotal}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">₹{inv.gst}</td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 text-sm">₹{inv.total}</td>
                    <td className="py-3 px-3">
                      {inv.status === 'paid' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                          <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Paid
                        </span>
                      )}
                      {inv.status === 'pending' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 w-max inline-block">
                          Pending Payment
                        </span>
                      )}
                      {inv.status === 'overdue' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 w-max inline-block">
                          Overdue
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => handleMarkPaid(inv.id)}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all"
                        >
                          Collect ₹{inv.total}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
              Clinic Expense Voucher Log
            </h3>
            <span className="text-xs text-slate-400 font-medium">Categorized petty cash & consumables</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Cost Category</th>
                  <th className="py-2.5 px-3">Voucher Note</th>
                  <th className="py-2.5 px-3 text-right">Debit Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 text-slate-500 font-mono">{exp.date}</td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700">{exp.category}</span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{exp.note}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600">₹{exp.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadein">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  Issue Patient Tax Invoice
                </h3>
                <p className="text-xs text-slate-500">Includes automatic 18% GST calculation</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>

            <form onSubmit={handleSubmit(handleCreateInvoice)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Patient Full Name</label>
                <input
                  type="text"
                  {...register('patientName')}
                  placeholder="e.g. Ramesh Verma"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                {errors.patientName && <p className="text-[11px] text-rose-600 mt-1">{errors.patientName.message}</p>}
              </div>

              {/* Quick Preset Services */}
              <div>
                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Quick Add Services:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { desc: 'OPD Consultation Fee', amt: 800 },
                    { desc: 'Follow-up Consultation', amt: 400 },
                    { desc: 'Dental Scaling & Polishing', amt: 1200 },
                    { desc: 'Composite Filling (per tooth)', amt: 950 },
                    { desc: 'Complete Blood Count (CBC)', amt: 450 },
                  ].map(srv => (
                    <button
                      key={srv.desc}
                      type="button"
                      onClick={() => append({ description: srv.desc, amount: srv.amt })}
                      className="text-[10.5px] font-semibold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      + {srv.desc} (₹{srv.amt})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Billed Line Items</label>
                  <button
                    type="button"
                    onClick={() => append({ description: '', amount: 500 })}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    + Add Custom Line
                  </button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      {...register(`lineItems.${idx}.description` as const)}
                      placeholder="Item description"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    />
                    <input
                      type="number"
                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                      placeholder="₹ Amount"
                      className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                    />
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm"
                >
                  Generate Tax Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ── */}
      {expenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadein">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Record Clinic Expense</h3>
              <button onClick={() => setExpenseModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">✕</button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                >
                  <option value="Medical Supplies">Medical Supplies</option>
                  <option value="Utilities">Utilities & Sanitation</option>
                  <option value="Equipment Maintenance">Equipment Maintenance</option>
                  <option value="Staff Refreshments">Staff Refreshments</option>
                  <option value="Other">Other Operational</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="₹ Amount"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="e.g. Syringes & sterile gloves batch"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-black"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}