import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const invoiceSchema = z.object({
  appointmentId: z.string().uuid('Select an appointment'),
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

export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [showModal, setShowModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { appointmentId: '', lineItems: [{ description: '', amount: 0 }] },
  })

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get('/invoices?status=unpaid')
      setInvoices(res.data)
    } catch (err) {
      console.error('Failed to fetch invoices:', err)
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    try {
      const res = await api.get('/payments')
      setPayments(res.data)
    } catch (err) {
      console.error('Failed to fetch payments:', err)
    }
  }, [])

  const onSubmit = useCallback(async (data: InvoiceForm) => {
    try {
      await api.post('/invoices', data)
      reset({ appointmentId: '', lineItems: [{ description: '', amount: 0 }] })
      setShowModal(false)
      fetchInvoices()
    } catch (err: any) {
      console.error('Failed to create invoice:', err)
      alert(err.response?.data?.error || 'Failed to create invoice')
    }
  }, [fetchInvoices])

  const onMarkPaid = useCallback(async (invoiceId: string, amount: number) => {
    try {
      await api.post(`/invoices/${invoiceId}/payment`, { method: 'cash', amount })
      fetchInvoices()
      fetchPayments()
    } catch (err: any) {
      console.error('Failed to record payment:', err)
      alert(err.response?.data?.error || 'Failed to record payment')
    }
  }, [fetchInvoices, fetchPayments])

  const onRazorpaySelect = useCallback(async (invoiceId: string, invoiceTotal: number) => {
    try {
      const res = await api.post(`/invoices/${invoiceId}/payment`, { method: 'razorpay', amount: invoiceTotal })
      alert(`Payment link: ${res.data.paymentLinkUrl}`)
    } catch (err: any) {
      console.error('Razorpay error:', err)
      alert(err.response?.data?.error || 'Failed to create payment link')
    }
  }, [])

  useEffect(() => {
    fetchInvoices()
    fetchPayments()
  }, [fetchInvoices, fetchPayments])

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Generate invoices and record payments</p>
        </div>
        <button onClick={() => { reset({ appointmentId: '', lineItems: [{ description: '', amount: 0 }] }); setShowModal(true); }} className="btn-primary">
          <PlusIcon className="w-5 h-5" aria-hidden="true" />
          Create Invoice
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg p-6 rounded-2xl glass-card animate-scale-in">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">New Invoice</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <label htmlFor="appointmentId" className="label">Appointment *</label>
                <select id="appointmentId" {...register('appointmentId')} className="input">
                  <option value="">Select appointment</option>
                </select>
                {errors.appointmentId && <p className="text-sm text-rose-600 mt-1">{errors.appointmentId.message}</p>}
              </div>

              <div>
                <label className="label">Line Items</label>
                <div className="space-y-3">
                  {fields.map((field: any, index: number) => (
                    <div key={field.id} className="grid gap-2 sm:grid-cols-3 p-3 rounded-xl bg-slate-50">
                      <input
                        {...register(`lineItems.${index}.description`)}
                        className="input"
                        placeholder="Description"
                      />
                      {errors.lineItems?.[index]?.description && <p className="text-sm text-rose-600">{errors.lineItems[index].description.message}</p>}
                      <input
                        type="number"
                        step="0.01"
                        {...register(`lineItems.${index}.amount`, { valueAsNumber: true })}
                        className="input"
                        placeholder="Amount"
                      />
                      {errors.lineItems?.[index]?.amount && <p className="text-sm text-rose-600">{errors.lineItems[index].amount.message}</p>}
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="btn-ghost p-1.5 self-end text-rose-600 hover:bg-rose-50" aria-label="Remove item">
                          <TrashIcon className="w-5 h-5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => append({ description: '', amount: 0 })} className="btn-secondary text-sm mt-2">
                  <PlusIcon className="w-4 h-4" aria-hidden="true" />
                  Add Item
                </button>
              </div>

              <p className="text-sm text-slate-500">GST @ 18% calculated automatically</p>

              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
              </button>
            </form>
            <button type="button" onClick={() => setShowModal(false)} className="mt-4 text-sm text-slate-600 hover:underline">Cancel</button>
          </div>
        </div>
      )}

      <div className="card-glass mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Outstanding Invoices</h2>
        <div className="space-y-2">
          {invoices.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No outstanding invoices</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId}>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.patientName}</td>
                    <td>{new Date(inv.appointmentDate).toLocaleDateString()}</td>
                    <td>₹{inv.subtotal.toLocaleString()}</td>
                    <td>₹{inv.gst.toLocaleString()}</td>
                    <td>₹{inv.total.toLocaleString()}</td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => onMarkPaid(inv.invoiceId, inv.total)} className="btn-primary text-sm px-3 py-1.5">
                          Cash
                        </button>
                        <button onClick={() => onRazorpaySelect(inv.invoiceId, inv.total)} className="btn-primary text-sm px-3 py-1.5">
                          Razorpay
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card-glass">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Payment History</h2>
        <div className="space-y-2">
          {payments.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No payments recorded</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pay) => (
                  <tr key={pay.paymentId}>
                    <td>{pay.invoiceId}</td>
                    <td>
                      <span className={`badge ${pay.method === 'cash' ? 'badge-success' : 'badge-primary'}`}>
                        {pay.method}
                      </span>
                    </td>
                    <td>₹{pay.amount.toLocaleString()}</td>
                    <td>{new Date(pay.createdAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${pay.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function TrashIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
}