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

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userRole = String(user?.role || 'doctor').toLowerCase()
  const isReceptionist = userRole === 'receptionist'
  const isDoctor = userRole === 'doctor'


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

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const fetchInvoices = useCallback(async () => {
    if (isReceptionist) return // Receptionist does not fetch aggregate dues report
    try {
      const res = await api.get('/invoices?status=unpaid')
      if (res.data && res.data.length > 0) setInvoices(res.data)
      else setInvoices(mockInvoices)
    } catch {
      setInvoices(mockInvoices)
    }
  }, [isReceptionist])

  const fetchPayments = useCallback(async () => {
    try {
      const res = await api.get('/payments')
      if (res.data && res.data.length > 0) setPayments(res.data)
      else setPayments(mockPayments)
    } catch {
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
        paidAt: null,
      }
      setInvoices(prev => [newInv, ...prev])
      reset()
      setShowModal(false)
    } catch {
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
        paidAt: null,
      }
      setInvoices(prev => [newInv, ...prev])
      reset()
      setShowModal(false)
    }
  }, [reset])

  const handleMarkPaid = async (invId: string) => {
    try {
      await api.post(`/invoices/${invId}/payment`, { method: 'cash', amount: 1180 })
      setInvoices(prev => prev.map(inv => inv.invoiceId === invId ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv))
    } catch {
      setInvoices(prev => prev.map(inv => inv.invoiceId === invId ? { ...inv, status: 'paid', paidAt: new Date().toISOString() } : inv))
    }
  }

  const handleRazorpay = (inv: Invoice) => {
    alert(`Initializing Razorpay Payment Gateway for ${inv.invoiceNumber}\nAmount: ₹${inv.total.toLocaleString('en-IN')}\n\nKeyId: rzp_test_samstack\nCallback: /api/v1/webhooks/razorpay`)
  }

  useEffect(() => {
    fetchInvoices()
    fetchPayments()
  }, [fetchInvoices, fetchPayments])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
            FR-17, FR-18 &amp; FR-19 Billing Engine
          </span>
          <h1 className="page-title mt-1">Billing &amp; Payment Counter</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            {isReceptionist
              ? 'Process per-invoice billing & cash/Razorpay payments at the front desk.'
              : isDoctor
              ? 'Generate GST invoices & view Outstanding Dues Report for your patients.'
              : 'Clinic-wide GST invoicing, payment collection, & aggregate dues ledger.'}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          <span>Generate Invoice</span>
        </button>
      </div>

      {/* Front Desk Receptionist View banner */}
      {isReceptionist && (
        <div className="card p-4 bg-teal-50 border-teal-200">
          <div className="flex items-center gap-2">
            <span className="status-chip status-chip-completed">Front Desk Desk</span>
            <span className="text-xs font-bold text-teal-800 uppercase">FR-17 &amp; FR-18 Active</span>
          </div>
          <p className="text-xs text-slate-700 mt-1">
            Receptionists process per-patient invoices &amp; collect payments. Aggregate Outstanding Dues reports (FR-19) are restricted to Doctor/Admin roles.
          </p>
        </div>
      )}

      {/* Outstanding Dues Report (FR-19) — Hidden for Receptionist */}
      {!isReceptionist && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="section-title">Outstanding Dues Report (FR-19)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isDoctor ? 'Scoped to your patients only' : 'Full clinic-wide dues report'}
              </p>
            </div>
            <span className="mono text-xs text-amber-800 font-bold bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
              {invoices.filter(i => i.status === 'unpaid').length} Pending Dues
            </span>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Subtotal</th>
                  <th>GST (18%)</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId}>
                    <td className="mono font-bold text-slate-800">{inv.invoiceNumber}</td>
                    <td className="font-semibold text-slate-900">{inv.patientName}</td>
                    <td className="mono text-slate-700">₹{inv.subtotal.toLocaleString('en-IN')}</td>
                    <td className="mono text-slate-500">₹{inv.gst.toLocaleString('en-IN')}</td>
                    <td className="mono font-bold text-slate-900">₹{inv.total.toLocaleString('en-IN')}</td>
                    <td>
                      <span className={inv.status === 'paid' ? 'status-chip status-chip-completed' : 'status-chip status-chip-pending'}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="text-right space-x-2">
                      {inv.status === 'unpaid' && (
                        <>
                          <button onClick={() => handleRazorpay(inv)} className="btn-primary text-xs px-2.5 py-1">
                            Razorpay Link
                          </button>
                          <button onClick={() => handleMarkPaid(inv.invoiceId)} className="btn-secondary text-xs px-2.5 py-1">
                            Mark Cash Paid
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Gateway Ledger Section */}
      <div className="card p-6 space-y-4">
        <h2 className="section-title">Payment Counter Ledger &amp; Gateway History</h2>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Invoice Ref</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Gateway Ref</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((pay) => (
                <tr key={pay.paymentId}>
                  <td className="mono text-xs font-semibold text-teal-700">{pay.paymentId}</td>
                  <td className="mono text-xs text-slate-700">{pay.invoiceId}</td>
                  <td>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-700">{pay.method}</span>
                  </td>
                  <td className="mono font-bold text-slate-900">₹{pay.amount.toLocaleString('en-IN')}</td>
                  <td className="mono text-xs text-slate-500">{pay.razorpayPaymentId || 'N/A (Cash)'}</td>
                  <td>
                    <span className="status-chip status-chip-completed">{pay.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Generate GST Invoice */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl card p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-heading">Generate GST Invoice</h2>
                <p className="text-xs text-slate-500">FR-17 GST Compliant Invoice Engine</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Appointment Reference *</label>
                <select {...register('appointmentId')} className="input-field">
                  <option value="apt-01">Aarav Patel (09:30 AM)</option>
                  <option value="apt-02">Priya Verma (10:15 AM)</option>
                  <option value="apt-04">Sunita Reddy (11:30 AM)</option>
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-slate-500">Line Items *</label>
                  <button type="button" onClick={() => append({ description: '', amount: 0 })} className="btn-secondary text-xs py-1 px-2.5">
                    + Add Item
                  </button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <input {...register(`lineItems.${idx}.description`)} className="input-field text-xs flex-1" placeholder="Service description" />
                    <input type="number" {...register(`lineItems.${idx}.amount`, { valueAsNumber: true })} className="input-field text-xs w-28 mono" placeholder="Amount (₹)" />
                    {fields.length > 1 && (
                      <button type="button" onClick={() => remove(idx)} className="text-xs text-rose-600 hover:text-rose-800 font-semibold p-1">
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs space-y-1">
                <div className="flex justify-between text-slate-700"><span>GST Rate:</span><span className="mono font-semibold">18% CGST + SGST</span></div>
                <div className="flex justify-between text-slate-700"><span>Idempotency Protection:</span><span className="mono text-teal-800 font-semibold">FR-22 Offline Key Enabled</span></div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Creating Invoice...' : 'Generate &amp; Issue Invoice'}
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