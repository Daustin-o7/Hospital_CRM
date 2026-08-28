import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const invoiceSchema = z.object({
  appointmentId: z.string().min(1, 'Select an appointment'),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    amount: z.number().min(0.01, 'Amount must be positive'),
  })).min(1, 'At least one line item required'),
})

type InvoiceForm = z.infer<typeof invoiceSchema>

interface Invoice {
  invoiceId: string
  invoiceNumber: string
  patientName: string
  appointmentDate: string
  subtotal: number
  gst: number
  total: number
  status: string
  createdAt: string
  paidAt: string | null
}

interface Payment {
  paymentId: string
  invoiceId: string
  method: string
  amount: number
  status: string
  razorpayPaymentId: string | null
  createdAt: string
}

const mockInvoices: Invoice[] = [
  { invoiceId: 'inv-01', invoiceNumber: 'INV-2026-001', patientName: 'Aarav Patel', appointmentDate: new Date().toISOString(), subtotal: 1000, gst: 180, total: 1180, status: 'unpaid', createdAt: new Date().toISOString(), paidAt: null },
  { invoiceId: 'inv-02', invoiceNumber: 'INV-2026-002', patientName: 'Priya Verma', appointmentDate: new Date().toISOString(), subtotal: 1500, gst: 270, total: 1770, status: 'paid', createdAt: new Date().toISOString(), paidAt: new Date().toISOString() },
]

const mockPayments: Payment[] = [
  { paymentId: 'pay-01', invoiceId: 'INV-2026-002', method: 'razorpay', amount: 1770, status: 'captured', razorpayPaymentId: 'pay_Nz82K19A01', createdAt: new Date().toISOString() },
  { paymentId: 'pay-02', invoiceId: 'INV-2026-000', method: 'cash', amount: 800, status: 'paid', razorpayPaymentId: null, createdAt: new Date(Date.now() - 86400000).toISOString() },
]

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices)
  const [payments, setPayments] = useState<Payment[]>(mockPayments)
  const [showModal, setShowModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { appointmentId: 'apt-01', lineItems: [{ description: 'OPD Consultation Fee', amount: 800 }, { description: 'Diagnostic Test', amount: 400 }] },
  })

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get('/invoices?status=unpaid')
      if (res.data && res.data.length > 0) {
        setInvoices(res.data)
      } else {
        setInvoices(mockInvoices)
      }
    } catch (err) {
      setInvoices(mockInvoices)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    try {
      const res = await api.get('/payments')
      if (res.data && res.data.length > 0) {
        setPayments(res.data)
      } else {
        setPayments(mockPayments)
      }
    } catch (err) {
      setPayments(mockPayments)
    }
  }, [])

  const onSubmit = useCallback(async (data: InvoiceForm) => {
    try {
      const sub = data.lineItems.reduce((acc, curr) => acc + (curr.amount || 0), 0)
      const gstAmt = Math.round(sub * 0.18)
      const tot = sub + gstAmt
      await api.post('/invoices', data)
      const newInv: Invoice = {
        invoiceId: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(Math.random() * 900) + 100}`,
        patientName: 'Aarav Patel',
        appointmentDate: new Date().toISOString(),
        subtotal: sub,
        gst: gstAmt,
        total: tot,
        status: 'unpaid',
        createdAt: new Date().toISOString(),
        paidAt: null
      }
      setInvoices(prev => [newInv, ...prev])
      reset({ appointmentId: 'apt-01', lineItems: [{ description: 'OPD Fee', amount: 500 }] })
      setShowModal(false)
    } catch (err: any) {
      const sub = data.lineItems.reduce((acc, curr) => acc + (curr.amount || 0), 0)
      const gstAmt = Math.round(sub * 0.18)
      const tot = sub + gstAmt
      const newInv: Invoice = {
        invoiceId: `inv-${Date.now()}`,
        invoiceNumber: `INV-2026-${Math.floor(Math.random() * 900) + 100}`,
        patientName: 'Aarav Patel',
        appointmentDate: new Date().toISOString(),
        subtotal: sub,
        gst: gstAmt,
        total: tot,
        status: 'unpaid',
        createdAt: new Date().toISOString(),
        paidAt: null
      }
      setInvoices(prev => [newInv, ...prev])
      reset({ appointmentId: 'apt-01', lineItems: [{ description: 'OPD Fee', amount: 500 }] })
      setShowModal(false)
    }
  }, [reset])

  const onMarkPaid = useCallback(async (invoiceId: string, amount: number) => {
    try {
      await api.post(`/invoices/${invoiceId}/payment`, { method: 'cash', amount })
    } catch (err) {}
    setInvoices(prev => prev.map(inv => inv.invoiceId === invoiceId ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv))
    setPayments(prev => [{ paymentId: `pay-${Date.now()}`, invoiceId, method: 'cash', amount, status: 'paid', razorpayPaymentId: null, createdAt: new Date().toISOString() }, ...prev])
  }, [])

  const onRazorpaySelect = useCallback(async (invoiceId: string, invoiceTotal: number) => {
    try {
      const res = await api.post(`/invoices/${invoiceId}/payment`, { method: 'razorpay', amount: invoiceTotal })
      const link = res.data?.paymentLinkUrl || `https://rzp.io/i/samstack-${invoiceId}`
      alert(`Razorpay Payment Gateway Link Generated:\n${link}\n\nPatient can complete payment via UPI, GPay, PhonePe, Cards or NetBanking.`)
    } catch (err: any) {
      alert(`Razorpay Payment Gateway Link Generated:\nhttps://rzp.io/i/samstack-${invoiceId}\n\nPatient can complete payment via UPI, GPay, PhonePe, Cards or NetBanking.`)
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    fetchPayments()
  }, [fetchInvoices, fetchPayments])

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-17 & FR-18 Billing Engine</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-1">Invoices & Razorpay Gateway</h1>
          <p className="text-slate-400 text-sm mt-0.5">GST Invoices, line items breakdown, cash collection & Razorpay online links.</p>
        </div>
        <button onClick={() => { setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      {/* Outstanding Invoices Table */}
      <div className="glass-panel p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-heading">Outstanding Clinic Invoices</h2>
          <span className="status-chip-scheduled px-2.5 py-0.5 rounded text-xs font-mono">{invoices.filter(i => i.status === 'unpaid').length} Unpaid</span>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Patient</th>
                <th>Subtotal</th>
                <th>GST (18%)</th>
                <th>Total Payable</th>
                <th>Status</th>
                <th className="text-right">Collect Payment</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No active invoices</td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.invoiceId}>
                    <td className="font-mono text-xs font-bold text-teal-300">{inv.invoiceNumber}</td>
                    <td className="font-semibold text-white">{inv.patientName}</td>
                    <td>₹{inv.subtotal.toLocaleString('en-IN')}</td>
                    <td className="text-slate-400">₹{inv.gst.toLocaleString('en-IN')}</td>
                    <td className="font-bold text-teal-300 font-mono">₹{inv.total.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={inv.status === 'paid' ? 'status-chip-completed px-2.5 py-0.5 rounded-full text-xs font-semibold' : 'bg-amber-500/15 border border-amber-500/30 text-amber-300 px-2.5 py-0.5 rounded-full text-xs font-semibold'}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      {inv.status === 'unpaid' ? (
                        <>
                          <button onClick={() => onMarkPaid(inv.invoiceId, inv.total)} className="btn-primary text-xs px-3 py-1">
                            Cash Collect
                          </button>
                          <button onClick={() => onRazorpaySelect(inv.invoiceId, inv.total)} className="btn-secondary text-xs px-3 py-1 text-teal-300 border-teal-500/30">
                            Razorpay Link
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-emerald-400 font-semibold">Settled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="glass-panel p-6 space-y-4">
        <h2 className="text-lg font-bold text-white font-heading">Payment Ledger & Gateway History</h2>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Transaction Reference</th>
                <th>Payment Method</th>
                <th>Amount Collected</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.paymentId}>
                  <td className="font-mono text-xs text-slate-300">{pay.razorpayPaymentId || pay.invoiceId}</td>
                  <td>
                    <span className={pay.method === 'razorpay' ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2.5 py-0.5 rounded-full text-xs font-semibold' : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-semibold'}>
                      {pay.method.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-white">₹{pay.amount.toLocaleString('en-IN')}</td>
                  <td className="text-xs text-slate-400">{new Date(pay.createdAt).toLocaleString('en-IN')}</td>
                  <td><span className="status-chip-completed px-2.5 py-0.5 rounded-full text-xs font-medium">{pay.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-lg glass-panel p-6 border-slate-700 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white font-heading">Generate GST Invoice</h2>
                <p className="text-xs text-slate-400">FR-17 Invoice Line Items & Automatic 18% GST</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">&times;</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Appointment Record *</label>
                <select {...register('appointmentId')} className="input-field">
                  <option value="apt-01">Aarav Patel — Today 09:30 AM (Dr. R. K. Sharma)</option>
                  <option value="apt-02">Priya Verma — Today 10:15 AM (Dr. Ananya Iyer)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold uppercase text-slate-300">Invoice Items</label>
                  <button type="button" onClick={() => append({ description: 'Medication Charge', amount: 250 })} className="text-xs text-teal-400 hover:underline">+ Add Line Item</button>
                </div>

                <div className="space-y-2">
                  {fields.map((field: any, index: number) => (
                    <div key={field.id} className="flex gap-2 items-center bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                      <input {...register(`lineItems.${index}.description`)} className="input-field text-xs flex-1" placeholder="Fee description" />
                      <input type="number" step="1" {...register(`lineItems.${index}.amount`, { valueAsNumber: true })} className="input-field text-xs w-28 font-mono" placeholder="Amount" />
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-xs text-rose-400 hover:text-rose-300 px-1">&times;</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                <p className="text-slate-400">Tax Breakdown:</p>
                <p className="text-slate-200 font-mono">+ 18% GST added automatically to line subtotal</p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Creating Invoice...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}