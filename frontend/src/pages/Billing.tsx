import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert, friendlyError } from '../components/ui/Alert'
import { InvoiceBadge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Schema ────────────────────────────────────────────────────────────────────
const invoiceSchema = z.object({
  appointmentId: z.string().min(1, 'Select an appointment'),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    amount: z.number().min(0.01, 'Amount must be positive'),
  })).min(1, 'At least one line item is required'),
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

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) => '₹' + n.toLocaleString('en-IN')
const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Billing() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [viewInv, setViewInv]   = useState<Invoice | null>(null)

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}') } catch { return {} } })()
  const userRole = String(user?.role || 'doctor').toLowerCase()
  const canCreate = ['clinicadmin', 'receptionist'].includes(userRole)
  const canPay    = ['clinicadmin', 'receptionist', 'doctor'].includes(userRole)

  const { register, handleSubmit, reset, control, formState: { isSubmitting } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { appointmentId: '', lineItems: [{ description: 'OPD Consultation Fee', amount: 800 }] },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/invoices')
      setInvoices(Array.isArray(res.data) ? res.data : [])
    } catch {
      setInvoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback(async (data: InvoiceForm) => {
    setSubmitError('')
    const sub = data.lineItems.reduce((acc, item) => acc + (item.amount || 0), 0)
    const gstAmt = Math.round(sub * 0.18)
    const tot = sub + gstAmt
    try {
      const res = await api.post('/invoices', data)
      setInvoices(prev => [res.data ?? {
        invoiceId: `inv-${Date.now()}`,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        patientName: 'Patient', appointmentDate: new Date().toISOString(),
        subtotal: sub, gst: gstAmt, total: tot,
        status: 'pending', createdAt: new Date().toISOString(), paidAt: null,
      }, ...prev])
      reset()
      setShowModal(false)
    } catch (err: any) {
      setSubmitError(friendlyError(err))
    }
  }, [reset])

  const handleMarkPaid = async (inv: Invoice) => {
    try {
      await api.post(`/invoices/${inv.invoiceId}/payment`, { method: 'cash', amount: inv.total })
      setInvoices(prev => prev.map(i => i.invoiceId === inv.invoiceId ? { ...i, status: 'paid', paidAt: new Date().toISOString() } : i))
      setViewInv(prev => prev?.invoiceId === inv.invoiceId ? { ...prev, status: 'paid', paidAt: new Date().toISOString() } : prev)
    } catch {}
  }

  const handleRazorpay = (inv: Invoice) => {
    alert(`Initializing Razorpay Payment Gateway for ${inv.invoiceNumber}\nAmount: ${fmt(inv.total)}`)
  }

  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  const totals = invoices.reduce((acc, inv) => ({
    revenue: acc.revenue + (inv.status === 'paid' ? inv.total : 0),
    pending: acc.pending + (['pending', 'unpaid'].includes(inv.status) ? inv.total : 0),
  }), { revenue: 0, pending: 0 })

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing & Invoices</h1>
          <p className="page-description">Generate invoices, track payments, and manage clinic revenue.</p>
        </div>
        {canCreate && (
          <button id="create-invoice-btn" className="btn btn-primary" onClick={() => { setSubmitError(''); setShowModal(true) }}>
            <PlusIcon />
            New invoice
          </button>
        )}
      </div>

      {/* ── Revenue summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total revenue', value: loading ? '—' : fmt(totals.revenue), color: 'var(--color-success)' },
          { label: 'Pending collection', value: loading ? '—' : fmt(totals.pending), color: 'var(--color-warning)' },
          { label: 'Invoices', value: loading ? '—' : `${invoices.length}`, color: 'var(--color-info)' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Invoices table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr><th>Invoice</th><th>Patient</th><th>Date</th><th>Subtotal</th><th>GST</th><th>Total</th><th>Status</th><th aria-label="Actions" /></tr>
            </thead>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody>
          </table>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<BillingIcon />}
            title="No invoices yet"
            description="Create your first invoice to start tracking clinic revenue."
            action={canCreate ? <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Create invoice</button> : undefined}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Invoices">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Patient</th>
                  <th>Date</th>
                  <th>Subtotal</th>
                  <th>GST</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.invoiceId} style={{ cursor: 'pointer' }} onClick={() => setViewInv(inv)}>
                    <td><span className="mono" style={{ fontWeight: 600, color: 'var(--color-text)' }}>{inv.invoiceNumber}</span></td>
                    <td style={{ fontWeight: 500, color: 'var(--color-text)' }}>{inv.patientName}</td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{fmtDate(inv.createdAt)}</td>
                    <td className="mono">{fmt(inv.subtotal)}</td>
                    <td className="mono" style={{ color: 'var(--color-text-muted)' }}>{fmt(inv.gst)}</td>
                    <td className="mono" style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: 14 }}>{fmt(inv.total)}</td>
                    <td><InvoiceBadge status={inv.status} /></td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); setViewInv(inv) }}
                        aria-label={`View invoice ${inv.invoiceNumber}`}
                        style={{ fontSize: 12.5, color: 'var(--brand-primary)', padding: '5px 10px' }}
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Invoice Modal ── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset(); setSubmitError('') }}
        title="Create invoice"
        description="Add line items and generate a new invoice."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); reset() }} disabled={isSubmitting}>Cancel</button>
            <button form="create-inv-form" type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Creating…' : 'Create invoice'}
            </button>
          </>
        }
      >
        {submitError && <div style={{ marginBottom: 16 }}><Alert variant="error" onDismiss={() => setSubmitError('')}>{submitError}</Alert></div>}

        <form id="create-inv-form" onSubmit={handleSubmit(onSubmit as any)} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="inv-appt" className="form-label">Appointment ID *</label>
            <input id="inv-appt" className="form-input" {...register('appointmentId')} placeholder="apt-xxxxxxxx" />
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="form-label" style={{ margin: 0 }}>Line items *</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => append({ description: '', amount: 0 })}>
                + Add item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {fields.map((field, i) => (
                <div key={field.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: 8, alignItems: 'start' }}>
                  <div>
                    <input className="form-input" {...register(`lineItems.${i}.description`)} placeholder="Description" />
                  </div>
                  <div>
                    <input type="number" className="form-input" {...register(`lineItems.${i}.amount`, { valueAsNumber: true })} placeholder="0" min="0" step="0.01" />
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => remove(i)}
                    aria-label="Remove line item"
                    style={{ padding: 8, color: 'var(--color-danger-text)', marginTop: 0 }}
                    disabled={fields.length === 1}
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── View Invoice Modal ── */}
      <Modal
        open={!!viewInv}
        onClose={() => setViewInv(null)}
        title="Invoice detail"
        description={viewInv?.invoiceNumber}
        footer={
          canPay && viewInv && !['paid'].includes(viewInv.status) ? (
            <>
              <button className="btn btn-secondary" onClick={() => handleMarkPaid(viewInv)}>Mark paid (cash)</button>
              <button className="btn btn-primary" onClick={() => handleRazorpay(viewInv)}>Pay via Razorpay</button>
            </>
          ) : undefined
        }
      >
        {viewInv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>
                  {fmt(viewInv.total)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {fmt(viewInv.subtotal)} + {fmt(viewInv.gst)} GST (18%)
                </div>
              </div>
              <InvoiceBadge status={viewInv.status} />
            </div>

            <hr className="divider" />

            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[
                { label: 'Invoice number', value: viewInv.invoiceNumber },
                { label: 'Patient', value: viewInv.patientName },
                { label: 'Issued', value: fmtDate(viewInv.createdAt) },
                { label: 'Paid on', value: viewInv.paidAt ? fmtDate(viewInv.paidAt) : '—' },
              ].map(f => (
                <div key={f.label}>
                  <dt style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{f.label}</dt>
                  <dd style={{ fontSize: 13.5, color: 'var(--color-text)', marginTop: 3, fontWeight: 500 }}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}
function BillingIcon() {
  return <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
}