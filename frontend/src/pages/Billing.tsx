import React, { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import { Alert, friendlyError } from '../components/ui/Alert'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'

const invoiceSchema = z.object({
  patientName: z.string().min(1, 'Patient name is required'),
  discountAmount: z.number().min(0),
  discountReason: z.string().optional(),
  autoFinalize: z.boolean(),
  lineItems: z.array(z.object({
    description: z.string().min(1, 'Description required'),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0.01, 'Unit price required'),
    taxCategory: z.enum(['Exempt', 'Nil', 'Taxable']),
    hsnSacCode: z.string(),
    gstRate: z.number().min(0),
  })).min(1, 'At least one line item is required'),
})

type InvoiceForm = z.infer<typeof invoiceSchema>

interface Invoice {
  invoiceId: string
  invoiceNumber: string
  patientName: string
  subtotal: number
  gstAmount: number
  discountAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  status: 'draft' | 'finalized' | 'issued' | 'paid' | 'partiallypaid' | 'cancelled' | 'refunded'
  createdAt: string
}

interface TaxProfile {
  isGstRegistered: boolean
  gstin?: string
  documentType: string
  defaultOpdTaxCategory: string
  thresholdHighValueUtr: number
}

interface DailyCollection {
  date: string
  totalConfirmed: number
  totalReportedPending: number
  confirmedCount: number
  reportedCount: number
  byMethod: Array<{ method: string; amount: number; count: number }>
}

interface OutstandingDues {
  totalOutstanding: number
  aging: {
    current0To30Days: number
    past31To60Days: number
    past61To90Days: number
    over90Days: number
  }
  invoices: Array<{
    invoiceId: string
    invoiceNumber: string
    patientName: string
    patientPhone?: string
    total: number
    paidAmount: number
    balanceDue: number
    status: string
    daysPast: number
    createdAt: string
  }>
}

interface DynamicQrData {
  invoiceId: string
  invoiceNumber: string
  amount: number
  upiUri: string
  qrSvg?: string
  account: {
    id: string
    vpa: string
    accountHolderName: string
    bankName: string
    accountNumberMasked: string
    priorityOrder: number
    isBackup: boolean
  }
  backupAvailable: boolean
}

interface PrintableInvoice {
  invoiceId: string
  invoiceNumber: string
  documentType: string
  watermark: string
  printCount: number
  clinic: {
    name?: string
    legalName?: string
    address?: string
    phone?: string
    email?: string
  }
  patient: {
    name: string
    uhid?: string
    phone?: string
  }
  doctor?: {
    name?: string
  }
  lineItems: Array<{
    description: string
    quantity: number
    unitPrice: number
    taxCategory: string
    hsnSacCode: string
    gstRate: number
    taxAmount: number
    discountAmount: number
    totalAmount: number
  }>
  subtotal: number
  gstAmount: number
  discountAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  status: string
  createdAt: string
}

export default function Billing() {
  const { user } = useAuth()
  const isClinicAdmin = user?.role === 'clinicadmin' || user?.role === 'owner'

  const [activeTab, setActiveTab] = useState<'invoices' | 'daily' | 'outstanding' | 'ledger'>('invoices')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [taxProfile, setTaxProfile] = useState<TaxProfile | null>(null)
  const [dailyCollection, setDailyCollection] = useState<DailyCollection | null>(null)
  const [outstandingDues, setOutstandingDues] = useState<OutstandingDues | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'err' } | null>(null)

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrData, setQrData] = useState<DynamicQrData | null>(null)
  const [selectedInvoiceForQr, setSelectedInvoiceForQr] = useState<Invoice | null>(null)
  const [isUsingBackupAccount, setIsUsingBackupAccount] = useState(false)

  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [confirmInvoice, setConfirmInvoice] = useState<Invoice | null>(null)
  const [confirmMethod, setConfirmMethod] = useState<'cash' | 'upi' | 'card' | 'netbanking'>('upi')
  const [confirmAmount, setConfirmAmount] = useState<number>(0)
  const [confirmUtr, setConfirmUtr] = useState('')

  const [creditNoteModalOpen, setCreditNoteModalOpen] = useState(false)
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null)
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0)
  const [creditNoteReason, setCreditNoteReason] = useState('')

  const [printModalOpen, setPrintModalOpen] = useState(false)
  const [printableData, setPrintableData] = useState<PrintableInvoice | null>(null)

  const showToast = (msg: string, type: 'success' | 'err' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      patientName: '',
      discountAmount: 0,
      autoFinalize: false,
      lineItems: [{ description: 'OPD General Consultation', quantity: 1, unitPrice: 800, taxCategory: 'Exempt', hsnSacCode: '999312', gstRate: 0 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' })
  const watchedLineItems = watch('lineItems') || []
  const watchedDiscount = watch('discountAmount') || 0

  const calculatedSubtotal = watchedLineItems.reduce((acc, item) => acc + ((item.quantity || 1) * (item.unitPrice || 0)), 0)
  const calculatedTax = watchedLineItems.reduce((acc, item) => {
    if (item.taxCategory === 'Taxable' && item.gstRate > 0) {
      const lineBase = (item.quantity || 1) * (item.unitPrice || 0)
      return acc + (lineBase * (item.gstRate / 100))
    }
    return acc
  }, 0)
  const calculatedGrandTotal = Math.max(0, calculatedSubtotal + calculatedTax - watchedDiscount)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [invRes, taxRes, dailyRes, duesRes] = await Promise.allSettled([
        api.get('/invoices'),
        api.get('/clinic/tax-profile'),
        api.get('/ledger/daily-collection'),
        api.get('/ledger/outstanding-dues'),
      ])

      if (invRes.status === 'fulfilled') setInvoices(invRes.value.data)
      if (taxRes.status === 'fulfilled') setTaxProfile(taxRes.value.data)
      if (dailyRes.status === 'fulfilled') setDailyCollection(dailyRes.value.data)
      if (duesRes.status === 'fulfilled') setOutstandingDues(duesRes.value.data)
    } catch {
      showToast('Error loading financial records.', 'err')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Create Invoice Handler
  const handleCreateInvoice = async (data: InvoiceForm) => {
    try {
      setActionLoading('create-invoice')
      const payload = {
        appointmentId: '00000000-0000-0000-0000-000000000000', // walk-in default or selected appointment
        discountAmount: data.discountAmount,
        discountReason: data.discountReason,
        autoFinalize: data.autoFinalize,
        lineItems: data.lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.quantity * item.unitPrice,
          taxCategory: item.taxCategory,
          hsnSacCode: item.hsnSacCode,
          gstRate: item.gstRate,
        })),
      }

      await api.post('/invoices', payload)
      showToast(`Invoice generated for ${data.patientName}.`)
      setCreateModalOpen(false)
      reset()
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Finalize Invoice Handler
  const handleFinalizeInvoice = async (invoiceId: string) => {
    try {
      setActionLoading(`finalize-${invoiceId}`)
      const res = await api.post(`/invoices/${invoiceId}/finalize`)
      showToast(`Invoice finalized as ${res.data.invoiceNumber}. Record locked and posted to general ledger.`)
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Open Dynamic UPI QR Modal
  const handleOpenDynamicQr = async (invoice: Invoice, useBackup: boolean = false) => {
    setSelectedInvoiceForQr(invoice)
    setIsUsingBackupAccount(useBackup)
    try {
      setActionLoading(`qr-${invoice.invoiceId}`)
      const res = await api.post(`/invoices/${invoice.invoiceId}/payments/dynamic-qr`, {
        useBackupAccount: useBackup
      })
      setQrData(res.data)
      setQrModalOpen(true)
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle Backup Account
  const handleToggleBackupAccount = () => {
    if (!selectedInvoiceForQr) return
    handleOpenDynamicQr(selectedInvoiceForQr, !isUsingBackupAccount)
  }

  // Patient Reports Payment (Hint only)
  const handlePatientReportedPayment = async () => {
    if (!selectedInvoiceForQr) return
    try {
      setActionLoading('report-payment')
      await api.post(`/invoices/${selectedInvoiceForQr.invoiceId}/payments/report`, {
        method: 'upi',
        amount: selectedInvoiceForQr.balanceDue || selectedInvoiceForQr.total
      })
      showToast('Payment marked as Reported. Staff must verify credit in bank app/soundbox before confirming.', 'success')
      setQrModalOpen(false)
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Open Confirm Payment Modal
  const handleOpenConfirmPayment = (invoice: Invoice) => {
    setConfirmInvoice(invoice)
    setConfirmAmount(invoice.balanceDue > 0 ? invoice.balanceDue : invoice.total)
    setConfirmMethod('upi')
    setConfirmUtr('')
    setConfirmModalOpen(true)
  }

  // Submit Payment Confirmation
  const handleSubmitConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmInvoice) return

    const threshold = taxProfile?.thresholdHighValueUtr || 2000
    if (confirmMethod !== 'cash' && confirmAmount >= threshold && !confirmUtr.trim()) {
      showToast(`Bank UTR / Transaction Reference is mandatory for amounts ₹${threshold.toLocaleString('en-IN')} and above.`, 'err')
      return
    }

    try {
      setActionLoading('confirm-payment')
      const res = await api.post(`/invoices/${confirmInvoice.invoiceId}/payments/confirm`, {
        method: confirmMethod,
        amount: Number(confirmAmount),
        utr: confirmUtr.trim() || undefined
      })

      showToast(`Payment of ₹${confirmAmount.toLocaleString('en-IN')} confirmed. Invoice status: ${res.data.status.toUpperCase()}.`)
      setConfirmModalOpen(false)
      await fetchData()
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Print Invoice Receipt
  const handlePrintReceipt = async (invoiceId: string) => {
    try {
      setActionLoading(`print-${invoiceId}`)
      const res = await api.get(`/invoices/${invoiceId}/print`)
      setPrintableData(res.data)
      setPrintModalOpen(true)
    } catch (err: any) {
      showToast(friendlyError(err), 'err')
    } finally {
      setActionLoading(null)
    }
  }

  // Open Credit Note Modal
  const handleOpenCreditNote = (invoice: Invoice) => {
    setCreditNoteInvoice(invoice)
    setCreditNoteAmount(invoice.balanceDue > 0 ? invoice.balanceDue : invoice.total)
    setCreditNoteReason('')
    setCreditNoteModalOpen(true)
  }

  // Submit Credit Note
  const handleSubmitCreditNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!creditNoteInvoice) return

    if (creditNoteAmount <= 0 || creditNoteAmount > creditNoteInvoice.total) {
      showToast(`Credit note amount must be between ₹1 and ₹${creditNoteInvoice.total}`, 'err')
      return
    }

    if (!creditNoteReason.trim()) {
      showToast('Clinical / administrative reason code required for credit note.', 'err')
      return
    }

    try {
      setActionLoading('credit-note')
      const res = await api.post(`/invoices/${creditNoteInvoice.invoiceId}/credit-notes`, {
        amount: Number(creditNoteAmount),
        reason: creditNoteReason.trim()
      })

      showToast(`Credit Note ${res.data.creditNoteNumber} issued. Receivable reversed in financial ledger.`)
      setCreditNoteModalOpen(false)
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
          <h1 className="page-title">Billing, Payments &amp; Ledger</h1>
          <p className="page-description">Manual-first billing engine with GST exemption rules, dynamic UPI QR capture, and append-only ledger reconciliation.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateModalOpen(true)}
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

      {/* ── Regulatory & Clinic Tax Status Banner ── */}
      <div className="p-4 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text)] font-heading">
                Notification 12/2017 Healthcare Exemption Active
              </span>
              <span className="badge badge-brand">
                {taxProfile?.documentType === 'TaxInvoice' ? 'Tax Invoice' : 'Bill of Supply'}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Outpatient consultations &amp; medical procedures are nil-rated (0% GST / SAC 999312). Pharmacy sales are billed as separate goods.
            </p>
          </div>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)] font-mono flex items-center gap-2">
          <span>High-Value UTR Threshold:</span>
          <span className="font-bold text-[var(--color-text)]">₹{(taxProfile?.thresholdHighValueUtr || 2000).toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card hover-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Confirmed Collections (Today)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="stat-value text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            ₹{Number(dailyCollection?.totalConfirmed || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 font-medium mt-0.5">
            {dailyCollection?.confirmedCount || 0} staff-confirmed payment credits
          </div>
        </div>

        <div className="stat-card hover-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Reported (Pending Credit)</span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="stat-value text-amber-600 dark:text-amber-400 font-mono mt-1">
            ₹{Number(dailyCollection?.totalReportedPending || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 font-medium mt-0.5">
            {dailyCollection?.reportedCount || 0} unverified patient payment claims
          </div>
        </div>

        <div className="stat-card hover-card">
          <div className="flex items-center justify-between">
            <span className="stat-label">Outstanding Patient Dues</span>
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          </div>
          <div className="stat-value text-rose-600 dark:text-rose-400 font-mono mt-1">
            ₹{Number(outstandingDues?.totalOutstanding || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 font-medium mt-0.5">
            {outstandingDues?.invoices?.length || 0} invoices awaiting settlement
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`btn btn-sm ${activeTab === 'invoices' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Clinical Invoices ({invoices.length})
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`btn btn-sm ${activeTab === 'daily' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Daily Tender Collections
        </button>
        <button
          onClick={() => setActiveTab('outstanding')}
          className={`btn btn-sm ${activeTab === 'outstanding' ? 'btn-primary' : 'btn-ghost'}`}
        >
          Outstanding Aging ({outstandingDues?.invoices?.length || 0})
        </button>
      </div>

      {/* ── Main Tab Contents ── */}
      {loading ? (
        <div className="card p-5 space-y-4">
          <div className="skeleton-card" />
          <div className="skeleton-list" />
        </div>
      ) : activeTab === 'invoices' ? (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
                Outpatient Service Bills
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Sequential gapless series (INV-YYYY-XXXXXX). In-house pharmacy is billed separately.</p>
            </div>
            <span className="badge badge-brand text-xs">Exempt SAC 999312</span>
          </div>

          {invoices.length === 0 ? (
            <EmptyState
              illustration={<svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="40" height="40" rx="6" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4"/>
                <path d="M20 25h20M20 35h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
              </svg>}
              title="No Invoices Found"
              description="Create your first patient consultation invoice with per-line tax calculations."
              action={{
                label: 'Create Invoice',
                onClick: () => setCreateModalOpen(true),
                variant: 'primary'
              }}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Invoice No</th>
                    <th>Patient</th>
                    <th>Date</th>
                    <th>Subtotal</th>
                    <th>GST</th>
                    <th>Total</th>
                    <th>Balance Due</th>
                    <th>Status</th>
                    <th className="text-right">Payment &amp; Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.invoiceId}>
                      <td className="font-mono font-bold text-xs text-[var(--color-text)]">
                        <span className="px-2 py-0.5 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded">
                          {inv.invoiceNumber}
                        </span>
                      </td>
                      <td className="font-bold text-[var(--color-text)]">{inv.patientName}</td>
                      <td className="text-[var(--color-text-muted)] text-xs">
                        {new Date(inv.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="font-mono text-xs text-[var(--color-text-secondary)]">₹{inv.subtotal?.toLocaleString('en-IN') || 0}</td>
                      <td className="font-mono text-xs text-[var(--color-text-secondary)]">₹{inv.gstAmount?.toLocaleString('en-IN') || 0}</td>
                      <td className="font-mono font-bold text-[var(--color-text)]">₹{inv.total?.toLocaleString('en-IN') || 0}</td>
                      <td className="font-mono font-bold text-xs text-rose-600 dark:text-rose-400">
                        ₹{(inv.balanceDue ?? inv.total).toLocaleString('en-IN')}
                      </td>
                      <td>
                        {inv.status === 'paid' ? (
                          <span className="badge badge-success">Paid</span>
                        ) : inv.status === 'partiallypaid' ? (
                          <span className="badge badge-warning">Partial</span>
                        ) : inv.status === 'draft' ? (
                          <span className="badge badge-secondary">Draft</span>
                        ) : (
                          <span className="badge badge-warning">Finalized</span>
                        )}
                      </td>
                      <td className="text-right space-x-1.5 whitespace-nowrap">
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleFinalizeInvoice(inv.invoiceId)}
                            disabled={actionLoading === `finalize-${inv.invoiceId}`}
                            className="btn btn-secondary btn-sm text-xs"
                            title="Lock invoice and generate sequential invoice number"
                          >
                            {actionLoading === `finalize-${inv.invoiceId}` ? 'Finalizing…' : 'Finalize'}
                          </button>
                        )}

                        {inv.status !== 'paid' && (
                          <>
                            <button
                              onClick={() => handleOpenDynamicQr(inv)}
                              disabled={actionLoading === `qr-${inv.invoiceId}`}
                              className="btn btn-primary btn-sm text-xs"
                              title="Generate dynamic UPI QR code on clinic screen"
                            >
                              Collect UPI QR
                            </button>
                            <button
                              onClick={() => handleOpenConfirmPayment(inv)}
                              className="btn btn-secondary btn-sm text-xs"
                              title="Staff confirm cash, card slip, or bank credit"
                            >
                              Confirm Credit
                            </button>
                          </>
                        )}

                        <button
                          onClick={() => handlePrintReceipt(inv.invoiceId)}
                          disabled={actionLoading === `print-${inv.invoiceId}`}
                          className="btn btn-ghost btn-sm text-xs"
                          title="Print server-side receipt with duplicate watermark"
                        >
                          Print
                        </button>

                        {isClinicAdmin && inv.status !== 'draft' && (
                          <button
                            onClick={() => handleOpenCreditNote(inv)}
                            className="btn btn-ghost btn-sm text-xs text-rose-500 hover:text-rose-600"
                            title="Dual-control reversal / credit note"
                          >
                            Credit Note
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
      ) : activeTab === 'daily' ? (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
                Today's Collections by Payment Method
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Reconciled bank credits vs direct cash collection for shift handover.</p>
            </div>
            <span className="text-xs font-mono font-bold text-[var(--color-text)]">{dailyCollection?.date}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {['cash', 'upi', 'card', 'netbanking'].map(methodKey => {
              const item = dailyCollection?.byMethod.find(m => m.method.toLowerCase() === methodKey)
              return (
                <div key={methodKey} className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                  <span className="text-xs uppercase font-bold text-[var(--color-text-muted)] tracking-wider font-mono">
                    {methodKey.toUpperCase()}
                  </span>
                  <div className="text-lg font-bold font-mono text-[var(--color-text)] mt-1">
                    ₹{(item?.amount || 0).toLocaleString('en-IN')}
                  </div>
                  <span className="text-[11px] text-[var(--color-text-muted)] font-medium">
                    {item?.count || 0} transactions
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text)] font-heading">
                Accounts Receivable &amp; Aging Analysis
              </h3>
              <p className="text-xs text-[var(--color-text-muted)] font-medium">Track overdue patient balances across standard aging buckets.</p>
            </div>
            <span className="badge badge-error">
              Total Due: ₹{(outstandingDues?.totalOutstanding || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-emerald-500/5">
              <span className="text-[11px] text-[var(--color-text-muted)] font-bold">0–30 Days (Current)</span>
              <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                ₹{(outstandingDues?.aging.current0To30Days || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-amber-500/5">
              <span className="text-[11px] text-[var(--color-text-muted)] font-bold">31–60 Days</span>
              <div className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                ₹{(outstandingDues?.aging.past31To60Days || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-orange-500/5">
              <span className="text-[11px] text-[var(--color-text-muted)] font-bold">61–90 Days</span>
              <div className="text-base font-bold font-mono text-orange-600 dark:text-orange-400 mt-0.5">
                ₹{(outstandingDues?.aging.past61To90Days || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--color-border)] bg-rose-500/5">
              <span className="text-[11px] text-[var(--color-text-muted)] font-bold">90+ Days Overdue</span>
              <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                ₹{(outstandingDues?.aging.over90Days || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Patient Name</th>
                  <th>Phone</th>
                  <th>Days Past</th>
                  <th>Total Bill</th>
                  <th>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {outstandingDues?.invoices.map(inv => (
                  <tr key={inv.invoiceId}>
                    <td className="font-mono text-xs">{inv.invoiceNumber}</td>
                    <td className="font-bold text-[var(--color-text)]">{inv.patientName}</td>
                    <td className="text-xs text-[var(--color-text-muted)]">{inv.patientPhone || '—'}</td>
                    <td>
                      <span className={`badge ${inv.daysPast > 60 ? 'badge-error' : inv.daysPast > 30 ? 'badge-warning' : 'badge-secondary'} text-xs`}>
                        {inv.daysPast} days
                      </span>
                    </td>
                    <td className="font-mono text-xs">₹{inv.total.toLocaleString('en-IN')}</td>
                    <td className="font-mono font-bold text-rose-600 dark:text-rose-400">₹{inv.balanceDue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dynamic UPI QR Modal ── */}
      <Modal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Dynamic UPI QR Code"
        description="Patient scans to pay directly into the clinic's verified bank account."
        size="md"
      >
        {qrData && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-white rounded-2xl border border-[var(--color-border)] inline-block shadow-sm">
              <div className="w-56 h-56 mx-auto flex items-center justify-center p-1">
                {qrData.qrSvg ? (
                  <img
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrData.qrSvg)}`}
                    alt={`UPI payment QR for ${qrData.invoiceNumber}`}
                    width={224}
                    height={224}
                    className="w-56 h-56"
                  />
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] px-4">
                    QR unavailable. Ask the patient to pay {qrData.account.vpa} directly.
                  </p>
                )}
              </div>
              <span className="block text-[11px] font-mono font-bold text-[var(--color-text)] mt-2">
                ₹{qrData.amount.toLocaleString('en-IN')} • {qrData.invoiceNumber}
              </span>
            </div>

            <div className="p-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl text-left text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Payee VPA:</span>
                <span className="font-mono font-bold text-[var(--color-text)]">{qrData.account.vpa}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Bank Account:</span>
                <span className="font-mono text-[var(--color-text)]">{qrData.account.bankName} ({qrData.account.accountNumberMasked})</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-[var(--color-border)]">
                <span className="text-[var(--color-text-muted)]">Account Priority:</span>
                <span className={`badge ${qrData.account.isBackup ? 'badge-warning' : 'badge-success'} text-[10px]`}>
                  {qrData.account.isBackup ? 'Secondary / Backup Account' : 'Primary Payee Account'}
                </span>
              </div>
            </div>

            {qrData.backupAvailable && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleToggleBackupAccount}
                  className="btn btn-secondary btn-sm text-xs"
                >
                  {isUsingBackupAccount ? 'Switch to Primary Account' : 'Switch to Backup Payee Account'}
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--color-border)]">
              <button
                type="button"
                onClick={handlePatientReportedPayment}
                disabled={actionLoading === 'report-payment'}
                className="btn btn-secondary btn-sm"
              >
                {actionLoading === 'report-payment' ? 'Recording…' : 'Patient Claims Paid'}
              </button>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                className="btn btn-primary btn-sm"
              >
                Close QR
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Staff Confirmation Modal ── */}
      <Modal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title="Confirm Payment Credit"
        description="Verify actual credit received in the clinic's bank app, soundbox, or cash drawer."
        size="sm"
      >
        <form onSubmit={handleSubmitConfirmPayment} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select
              value={confirmMethod}
              onChange={(e: any) => setConfirmMethod(e.target.value)}
              className="form-select"
            >
              <option value="upi">UPI (GPay, PhonePe, Paytm, BHIM)</option>
              <option value="cash">Cash (Direct Handover)</option>
              <option value="card">Card Terminal Swipe (Slip Ref)</option>
              <option value="netbanking">Bank Transfer (NEFT / RTGS / IMPS)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Amount Confirmed (₹)</label>
            <input
              type="number"
              value={confirmAmount}
              onChange={(e) => setConfirmAmount(Number(e.target.value))}
              className="form-input font-mono"
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Bank UTR / Transaction Ref
              {confirmMethod !== 'cash' && confirmAmount >= (taxProfile?.thresholdHighValueUtr || 2000) && (
                <span className="text-rose-500 font-bold ml-1">* Mandatory for ₹{(taxProfile?.thresholdHighValueUtr || 2000).toLocaleString('en-IN')}+</span>
              )}
            </label>
            <input
              type="text"
              value={confirmUtr}
              onChange={(e) => setConfirmUtr(e.target.value)}
              placeholder="e.g. UTR-HDFC-9928374625"
              className="form-input font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setConfirmModalOpen(false)}
              className="btn btn-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'confirm-payment'}
              className="btn btn-primary cursor-pointer"
            >
              {actionLoading === 'confirm-payment' ? 'Confirming…' : 'Confirm & Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Credit Note Modal ── */}
      <Modal
        open={creditNoteModalOpen}
        onClose={() => setCreditNoteModalOpen(false)}
        title="Issue Credit Note"
        description="Dual-control reversal. Enforces immutable ledger record rather than mutating finalized bills."
        size="sm"
      >
        <form onSubmit={handleSubmitCreditNote} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Credit Note Amount (₹)</label>
            <input
              type="number"
              value={creditNoteAmount}
              onChange={(e) => setCreditNoteAmount(Number(e.target.value))}
              className="form-input font-mono"
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Clinical / Administrative Reason</label>
            <textarea
              value={creditNoteReason}
              onChange={(e) => setCreditNoteReason(e.target.value)}
              placeholder="e.g. Procedure cancelled due to clinical condition; fee waived by Dr. Sharma."
              className="form-input"
              rows={3}
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setCreditNoteModalOpen(false)}
              className="btn btn-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'credit-note'}
              className="btn btn-danger cursor-pointer"
            >
              {actionLoading === 'credit-note' ? 'Issuing…' : 'Issue Credit Note'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Printable Invoice Receipt Modal ── */}
      <Modal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        title="Print Patient Bill of Supply"
        description="Server-side rendered layout with watermark and copy audit."
        size="lg"
      >
        {printableData && (
          <div className="space-y-4 p-4 border border-[var(--color-border)] rounded-2xl bg-white text-gray-900 font-sans print:border-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-gray-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{printableData.clinic.name}</h2>
                <p className="text-xs text-gray-600">{printableData.clinic.legalName}</p>
                <p className="text-xs text-gray-500">{printableData.clinic.address} • Ph: {printableData.clinic.phone}</p>
              </div>
              <div className="text-right">
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${printableData.watermark === 'ORIGINAL' ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'}`}>
                  {printableData.watermark}
                </span>
                <p className="text-xs font-mono font-bold mt-1 text-gray-800">{printableData.invoiceNumber}</p>
                <p className="text-[11px] text-gray-500">{printableData.documentType}</p>
              </div>
            </div>

            {/* Patient & Doctor Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs py-2 border-b border-gray-100">
              <div>
                <span className="text-gray-500 font-medium">Patient Details:</span>
                <p className="font-bold text-gray-900">{printableData.patient.name}</p>
                <p className="text-gray-600">UHID: {printableData.patient.uhid || '—'} • Ph: {printableData.patient.phone || '—'}</p>
              </div>
              <div className="text-right">
                <span className="text-gray-500 font-medium">Treating Practitioner:</span>
                <p className="font-bold text-gray-900">{printableData.doctor?.name || 'Authorized Medical Officer'}</p>
                <p className="text-gray-500">{new Date(printableData.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
            </div>

            {/* Table of Line Items */}
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-1.5">Description</th>
                  <th className="py-1.5">SAC/HSN</th>
                  <th className="py-1.5 text-center">Tax Cat</th>
                  <th className="py-1.5 text-center">Qty</th>
                  <th className="py-1.5 text-right">Rate</th>
                  <th className="py-1.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {printableData.lineItems.map((li, idx) => (
                  <tr key={idx}>
                    <td className="py-1.5 font-medium text-gray-800">{li.description}</td>
                    <td className="py-1.5 font-mono text-gray-500">{li.hsnSacCode}</td>
                    <td className="py-1.5 text-center font-mono text-[11px]">
                      {li.taxCategory === 'Exempt' ? '0% (Exempt)' : `${li.gstRate}%`}
                    </td>
                    <td className="py-1.5 text-center font-mono">{li.quantity}</td>
                    <td className="py-1.5 text-right font-mono">₹{li.unitPrice}</td>
                    <td className="py-1.5 text-right font-mono font-bold">₹{li.totalAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="border-t border-gray-200 pt-2 flex justify-end">
              <div className="w-56 text-xs space-y-1 font-mono">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal:</span>
                  <span>₹{printableData.subtotal}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>GST (Exempt lines: 0%):</span>
                  <span>₹{printableData.gstAmount}</span>
                </div>
                {printableData.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-₹{printableData.discountAmount}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 border-t border-gray-300 pt-1">
                  <span>Total Amount:</span>
                  <span>₹{printableData.total}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Paid Amount:</span>
                  <span>₹{printableData.paidAmount}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-rose-600">
                  <span>Balance Due:</span>
                  <span>₹{printableData.balanceDue}</span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-gray-400 text-center pt-2 border-t border-gray-100">
              Healthcare services exempt from GST under Notification No. 12/2017-Central Tax (Rate). Computer generated invoice.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn btn-primary btn-sm"
              >
                Print / Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Invoice Modal ── */}
      <Modal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Patient Invoice"
        description="Per-line tax calculation based on Notification 12/2017 healthcare exemptions."
        size="lg"
      >
        <form onSubmit={handleSubmit(handleCreateInvoice)} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Patient Full Name</label>
            <input
              type="text"
              {...register('patientName')}
              placeholder="e.g. Ramesh Kumar"
              className="form-input"
            />
            {errors.patientName && <p className="form-error">{errors.patientName.message}</p>}
          </div>

          {/* Quick Add Presets */}
          <div>
            <span className="text-[10.5px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider block mb-1 font-mono">
              Quick Add Healthcare Services (Exempt 0% GST):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { desc: 'OPD General Consultation', amt: 800, sac: '999312', cat: 'Exempt' as const },
                { desc: 'Follow-up Consultation', amt: 400, sac: '999312', cat: 'Exempt' as const },
                { desc: 'Specialist Consultation', amt: 1200, sac: '999312', cat: 'Exempt' as const },
                { desc: 'Wound Dressing & Nursing', amt: 350, sac: '999312', cat: 'Exempt' as const },
                { desc: 'In-Clinic ECG Procedure', amt: 500, sac: '999312', cat: 'Exempt' as const },
              ].map(srv => (
                <button
                  key={srv.desc}
                  type="button"
                  onClick={() => append({ description: srv.desc, quantity: 1, unitPrice: srv.amt, taxCategory: srv.cat, hsnSacCode: srv.sac, gstRate: 0 })}
                  className="btn btn-secondary btn-sm text-[10.5px]"
                >
                  + {srv.desc} (₹{srv.amt})
                </button>
              ))}
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="form-label mb-0">Billed Services &amp; Goods</label>
              <button
                type="button"
                onClick={() => append({ description: '', quantity: 1, unitPrice: 500, taxCategory: 'Exempt', hsnSacCode: '999312', gstRate: 0 })}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                + Add Custom Service Line
              </button>
            </div>

            {fields.map((field, idx) => (
              <div key={field.id} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] space-y-2">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    {...register(`lineItems.${idx}.description` as const)}
                    placeholder="Service description"
                    className="form-input flex-1 text-xs"
                  />
                  <input
                    type="number"
                    {...register(`lineItems.${idx}.quantity` as const, { valueAsNumber: true })}
                    placeholder="Qty"
                    className="form-input w-16 font-mono text-xs"
                    min="1"
                  />
                  <input
                    type="number"
                    {...register(`lineItems.${idx}.unitPrice` as const, { valueAsNumber: true })}
                    placeholder="Rate"
                    className="form-input w-24 font-mono text-xs"
                    min="0"
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(idx)}
                      className="text-[var(--color-text-muted)] hover:text-rose-500 p-1 cursor-pointer"
                      title="Remove line"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)]">Tax Category</label>
                    <select
                      {...register(`lineItems.${idx}.taxCategory` as const)}
                      className="form-select text-xs py-1"
                    >
                      <option value="Exempt">Exempt (0% - Notif 12/2017)</option>
                      <option value="Nil">Nil-Rated</option>
                      <option value="Taxable">Taxable Goods</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)]">SAC / HSN Code</label>
                    <input
                      type="text"
                      {...register(`lineItems.${idx}.hsnSacCode` as const)}
                      placeholder="999312"
                      className="form-input text-xs py-1 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--color-text-muted)]">GST Rate (%)</label>
                    <input
                      type="number"
                      {...register(`lineItems.${idx}.gstRate` as const, { valueAsNumber: true })}
                      placeholder="0"
                      className="form-input text-xs py-1 font-mono"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Discount & Finalize Toggle */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="form-label text-xs">Discount Amount (₹)</label>
              <input
                type="number"
                {...register('discountAmount', { valueAsNumber: true })}
                placeholder="0"
                className="form-input font-mono text-xs"
                min="0"
              />
            </div>
            <div>
              <label className="form-label text-xs">Discount Reason Code</label>
              <input
                type="text"
                {...register('discountReason')}
                placeholder="SeniorCitizen / StaffFamily / Discretion"
                className="form-input text-xs"
              />
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-3 bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-xl font-mono text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Subtotal:</span>
              <span>₹{calculatedSubtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--color-text-muted)]">Tax Amount (Exempt Lines: 0%):</span>
              <span>₹{calculatedTax.toLocaleString('en-IN')}</span>
            </div>
            {watchedDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Discount:</span>
                <span>-₹{watchedDiscount.toLocaleString('en-IN')}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-[var(--color-text)] border-t border-[var(--color-border)] pt-1">
              <span>Total Payable:</span>
              <span>₹{calculatedGrandTotal.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="autoFinalize"
              {...register('autoFinalize')}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="autoFinalize" className="text-xs text-[var(--color-text-secondary)] cursor-pointer">
              Finalize immediately and assign sequential invoice number (locks record)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-border)]">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="btn btn-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'create-invoice'}
              className="btn btn-primary cursor-pointer"
            >
              {actionLoading === 'create-invoice' ? 'Generating…' : 'Generate Invoice'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
