import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Alert, friendlyError } from '../components/ui/Alert'

const invoiceSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    amount: z.number().min(1, 'Amount must be positive'),
  })).min(1, 'At least one line item is required'),
})

type InvoiceForm = z.infer<typeof invoiceSchema>

interface Invoice {
  invoiceId: string
  invoiceNumber: string
  patientName: string
  total: number
  status: 'paid' | 'unpaid' | 'pending' | 'issued'
  createdAt: string
}

interface Expense {
  id: string
  category: string
  amount: number
  expenseDate: string
  note: string
}

interface LedgerSummary {
  income: number
  expenses: {
    total: number
    byCategory: Array<{ category: string; total: number }>
  }
  net: number
}

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [summary, setSummary] = useState<LedgerSummary>({
    income: 0,
    expenses: { total: 0, byCategory: [] },
    net: 0
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'invoices' | 'ledger'>('invoices')
  const [modalOpen, setModalOpen] = useState(false)
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [expCategory, setExpCategory] = useState('MedicalSupplies')
  const [expAmount, setExpAmount] = useState('1000')
  const [expNote, setExpNote] = useState('')

  const showToast = (msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      patientName: '',
      lineItems: [{ description: 'OPD Consultation Fee', amount: 800 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, expRes, sumRes] = await Promise.allSettled([
        api.get('/invoices'),
        api.get('/ledger/expenses'),
        api.get('/ledger/daily')
      ])

      if (invRes.status === 'fulfilled') {
        setInvoices(invRes.value.data || [])
      }
      if (expRes.status === 'fulfilled') {
        setExpenses(expRes.value.data || [])
      }
      if (sumRes.status === 'fulfilled') {
        const data = sumRes.value.data
        // daily endpoint returns { date, income, expenses, net }
        // map to summary shape for compatibility
        setSummary({
          income: data.income?.total ?? 0,
          expenses: { total: data.expenses?.total ?? 0, byCategory: data.expenses?.byCategory ?? [] },
          net: data.net ?? 0
        })
      }
    } catch (err: any) {
      showToast('Failed to load billing data', 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateInvoice = async (data: InvoiceForm) => {
    try {
      setActionLoading('create-invoice')
      const sub = data.lineItems.reduce((acc, item) => acc + Number(item.amount || 0), 0)
      const gstAmt = Math.round(sub * 0.18)
      const tot = sub + gstAmt

      // Push walk-in / patient invoice via sync push endpoint
      const syncItem = {
        id: crypto.randomUUID(),
        type: 2,
        idempotencyKey: `IDEMP-INV-${crypto.randomUUID()}`,
        payloadJson: JSON.stringify({
          walkInCustomerName: data.patientName,
          subtotal: sub,
          gstAmount: gstAmt,
          total: tot,
          paymentMethod: 'Cash'
        }),
        createdAt: new Date().toISOString()
      }

      await api.post('/sync/push', { items: [syncItem] })
      showToast(`Invoice generated for ${data.patientName}.`)
      setModalOpen(false)
      reset()
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!expAmount || isNaN(Number(expAmount))) return

    try {
      setActionLoading('create-expense')
      await api.post('/ledger/expenses', {
        category: expCategory,
        amount: Number(expAmount),
        expenseDate: new Date().toISOString().split('T')[0],
        note: expNote || undefined
      })

      showToast('Expense recorded to clinic ledger.')
      setExpenseModalOpen(false)
      setExpNote('')
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCollectPayment = async (invoiceId: string, amount: number) => {
    try {
      setActionLoading(`pay-${invoiceId}`)
      await api.post(`/invoices/${invoiceId}/payment`, {
        method: 'cash',
        amount: amount,
        idempotencyKey: `IDEMP-PAY-${crypto.randomUUID()}`
      })

      showToast(`Payment of ₹${amount} recorded as PAID.`)
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing &amp; Finance Ledger</h1>
          <p className="page-description">Manage patient invoices, tax collection, and clinic operational expenditure.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="btn btn-secondary"
          >
            + Add Expense
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="btn btn-primary"
          >
            + Create Invoice
          </button>
        </div>
      </div>

      {toast && (
        <div className="animate-fadein">
          <Alert variant={toast.type === 'err' ? 'error' : 'success'} onDismiss={() => setToast(null)}>
            {toast.msg}
          </Alert>
        </div>
      )}

      {/* ── Finance Ledger Summary Card ── */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[var(--color-text)] tracking-tight font-heading">
                Daily Revenue &amp; Cash Ledger
              </h2>
              <span className="badge badge-brand">
                GSTIN: 27AABCS1429B1ZB
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] font-medium mt-0.5">Real-time collections, invoice aging, and clinic expenditure reconciliation.</p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`btn btn-sm ${activeTab === 'invoices' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Tax Invoices ({invoices.length})
            </button>
            <button
              onClick={() => setActiveTab('ledger')}
              className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-ghost'}`}
            >
              Expense Ledger ({expenses.length})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Total Revenue</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            </div>
            <div className="stat-value text-emerald-600 dark:text-emerald-400 font-mono mt-1">
              ₹{Number(summary.income || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">
              Includes ₹{Math.round((summary.income || 0) * 0.18 / 1.18).toLocaleString('en-IN')} GST Collected
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Total Expenses</span>
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            </div>
            <div className="stat-value text-rose-600 dark:text-rose-400 font-mono mt-1">
              ₹{Number(summary.expenses?.total || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5">
              {expenses.length} ledger voucher entries
            </div>
          </div>

          <div className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">Net Operating Margin</span>
              <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            </div>
            <div className="stat-value text-teal-600 dark:text-teal-400 font-mono mt-1">
              ₹{Number(summary.net || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-teal-600/80 dark:text-teal-400/80 font-medium mt-0.5">
              Operational surplus this period
            </div>
          </div>
        </div>
      </div>

      {/* ── Table Content ── */}
      {loading ? (
        <div className="card p-8 text-center">
          <span className="spinner spinner-lg mx-auto mb-3" />
          <div className="text-[var(--color-text-muted)] text-sm">Loading billing records…</div>
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
              Issued Tax Invoices
            </h3>
            <span className="text-xs text-[var(--color-text-muted)] font-medium">Standard HSN / SAC billing rules</span>
          </div>

          {invoices.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Invoices Found</div>
              <p className="empty-state-description">Generate your first tax invoice for consultations or pharmacy items.</p>
              <button onClick={() => setModalOpen(true)} className="btn btn-primary btn-sm mt-3">
                + Create Invoice
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice Number</th>
                    <th>Patient Profile</th>
                    <th>Date</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td className="font-mono font-bold text-[var(--color-text)]">
                        <span className="px-2 py-0.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)]">{inv.invoiceNumber}</span>
                      </td>
                      <td className="font-bold text-[var(--color-text)]">{inv.patientName}</td>
                      <td className="text-[var(--color-text-muted)] text-xs">{new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="font-mono font-bold text-[var(--color-text)]">₹{inv.total}</td>
                      <td>
                        {inv.status === 'paid' ? (
                          <span className="badge badge-success">Paid</span>
                        ) : (
                          <span className="badge badge-warning">Unpaid</span>
                        )}
                      </td>
                      <td className="text-right">
                        {inv.status !== 'paid' && (
                          <button
                            onClick={() => handleCollectPayment(inv.invoiceId, inv.total)}
                            disabled={actionLoading === `pay-${inv.invoiceId}`}
                            className="btn btn-primary btn-sm"
                          >
                            {actionLoading === `pay-${inv.invoiceId}` ? 'Collecting…' : `Collect ₹${inv.total}`}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
              Clinic Expense Voucher Log
            </h3>
            <span className="text-xs text-[var(--color-text-muted)] font-medium">Categorized petty cash &amp; operational consumables</span>
          </div>

          {expenses.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">No Expenses Logged</div>
              <p className="empty-state-description">Record medical supplies, utilities, or maintenance expenses to track ledger balances.</p>
              <button onClick={() => setExpenseModalOpen(true)} className="btn btn-secondary btn-sm mt-3">
                + Add Expense
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Cost Category</th>
                    <th>Voucher Note</th>
                    <th className="text-right">Debit Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td className="text-[var(--color-text-muted)] font-mono text-xs">{exp.expenseDate}</td>
                      <td className="font-bold text-[var(--color-text)]">
                        <span className="px-2 py-0.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] capitalize">{exp.category}</span>
                      </td>
                      <td className="text-[var(--color-text-secondary)] text-xs">{exp.note || '—'}</td>
                      <td className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">₹{exp.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Create Invoice Modal ── */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-lg p-6 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <div>
                <h3 className="text-base font-bold text-[var(--color-text)] font-heading">
                  Issue Patient Tax Invoice
                </h3>
                <p className="text-xs text-[var(--color-text-muted)]">Includes automatic 18% GST calculation</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="btn btn-ghost p-1">✕</button>
            </div>

            <form onSubmit={handleSubmit(handleCreateInvoice)} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Patient Full Name</label>
                <input
                  type="text"
                  {...register('patientName')}
                  placeholder="e.g. Ramesh Verma"
                  className="form-input"
                />
                {errors.patientName && <p className="form-error">{errors.patientName.message}</p>}
              </div>

              {/* Quick Preset Services */}
              <div>
                <span className="text-[10.5px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1 font-mono">Quick Add Services:</span>
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
                      className="btn btn-secondary btn-sm text-[10.5px]"
                    >
                      + {srv.desc} (₹{srv.amt})
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="form-label mb-0">Billed Line Items</label>
                  <button
                    type="button"
                    onClick={() => append({ description: '', amount: 500 })}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
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
                      className="form-input flex-1"
                    />
                    <input
                      type="number"
                      {...register(`lineItems.${idx}.amount` as const, { valueAsNumber: true })}
                      placeholder="₹ Amount"
                      className="form-input w-28 font-mono"
                    />
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="text-[var(--color-text-muted)] hover:text-rose-500 p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-invoice'}
                  className="btn btn-primary"
                >
                  {actionLoading === 'create-invoice' ? 'Generating…' : 'Generate Tax Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add Expense Modal ── */}
      {expenseModalOpen && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-md p-6 space-y-4 animate-fadein">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
              <h3 className="text-base font-bold text-[var(--color-text)] font-heading">
                Record Clinic Expense
              </h3>
              <button onClick={() => setExpenseModalOpen(false)} className="btn btn-ghost p-1">✕</button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="form-select"
                >
                  <option value="MedicalSupplies">Medical Supplies</option>
                  <option value="Utilities">Utilities &amp; Sanitation</option>
                  <option value="EquipmentMaintenance">Equipment Maintenance</option>
                  <option value="StaffRefreshments">Staff Refreshments</option>
                  <option value="Other">Other Operational</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  type="number"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="₹ Amount"
                  className="form-input font-mono"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes / Description</label>
                <input
                  type="text"
                  value={expNote}
                  onChange={(e) => setExpNote(e.target.value)}
                  placeholder="e.g. Syringes &amp; sterile gloves batch"
                  className="form-input"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-expense'}
                  className="btn btn-primary"
                >
                  {actionLoading === 'create-expense' ? 'Saving…' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}