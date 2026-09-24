import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert, friendlyError } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Schema ────────────────────────────────────────────────────────────────────
const staffSchema = z.object({
  name:  z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  role:  z.enum(['Doctor', 'Receptionist', 'Pharmacist', 'Nurse', 'Admin']),
})
type StaffForm = z.infer<typeof staffSchema>

interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  status: string
  joinedAt: string
}

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Doctor: ['EHR Clinical Notes', 'Rx Digital Signature', 'Lab Order Review', 'DPDP Patient Access'],
  Receptionist: ['Patient Registration', 'Slot Scheduling', 'Token Triage Override', 'Cash Billing'],
  Pharmacist: ['Pharmacy POS Counter', 'Batch FEFO Dispense', 'Schedule H1 Register', 'Stock Inwarding'],
  Nurse: ['Vitals Capture', 'Pre-check Triage', 'Consumables Usage', 'Lobby Queue Calling'],
  Admin: ['Staff Invite & RBAC', 'Financial ITR Reports', 'Clinic Configuration', 'Audit Log Export']
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) }
  catch { return '—' }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Staff() {
  const [staff, setStaff]             = useState<StaffMember[]>([
    { id: 'st-1', name: 'Dr. Arjun Mehta', email: 'dr.mehta@samstack.health', role: 'Doctor', status: 'Active', joinedAt: '2026-01-15T09:00:00Z' },
    { id: 'st-2', name: 'Priya Nair', email: 'priya.reception@samstack.health', role: 'Receptionist', status: 'Active', joinedAt: '2026-02-01T08:30:00Z' },
    { id: 'st-3', name: 'Suresh Menon', email: 'suresh.pharmacy@samstack.health', role: 'Pharmacist', status: 'Active', joinedAt: '2026-03-10T10:00:00Z' },
    { id: 'st-4', name: 'Dr. Ananya Sharma', email: 'dr.sharma@samstack.health', role: 'Doctor', status: 'Invited', joinedAt: '2026-08-25T14:20:00Z' },
  ])
  const [loading, setLoading]         = useState(false)
  const [activeTab, setActiveTab]     = useState<'all' | 'Active' | 'Invited'>('all')
  const [showModal, setShowModal]     = useState(false)
  const [showMatrix, setShowMatrix]   = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [toast, setToast]             = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', role: 'Doctor' },
  })

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/staff')
      if (Array.isArray(res.data) && res.data.length > 0) {
        setStaff(res.data)
      }
    } catch {
      // Retain baseline staff
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback(async (data: StaffForm) => {
    setSubmitError('')
    try {
      await api.post('/staff/invite', data)
      setStaff(prev => [{
        id: `st-${Date.now()}`, name: data.name, email: data.email,
        role: data.role, status: 'Invited', joinedAt: new Date().toISOString(),
      }, ...prev])
      reset({ name: '', email: '', role: 'Doctor' })
      showToast(`Invitation sent to ${data.email}`)
      setShowModal(false)
    } catch (err: any) {
      setSubmitError(friendlyError(err))
    }
  }, [reset])

  const copyInviteLink = (email: string) => {
    navigator.clipboard?.writeText(`https://crm.samstack.health/accept-invite?email=${encodeURIComponent(email)}`)
    showToast(`Copied direct onboarding link for ${email}`)
  }

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const filteredStaff = staff.filter(s => activeTab === 'all' || s.status === activeTab)
  const doctors       = staff.filter(s => s.role === 'Doctor')
  const receptionists = staff.filter(s => s.role === 'Receptionist')
  const pharmacists   = staff.filter(s => s.role === 'Pharmacist')

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Page header ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              Azure Entra External ID Role Governance
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Module 01 & 08</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading mt-1 text-[var(--color-text)]">
            Clinical Team Directory & Access Control
          </h1>
          <p className="text-xs font-medium mt-0.5 text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : `${staff.length} team members · ${doctors.length} Doctors · ${receptionists.length} Reception · ${pharmacists.length} Pharmacy`}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="btn btn-secondary btn-sm cursor-pointer"
          >
            <span>🛡️ View RBAC Matrix</span>
          </button>
          <button
            id="invite-staff-btn"
            className="btn btn-primary btn-sm cursor-pointer"
            onClick={() => { setSubmitError(''); reset({ name: '', email: '', role: 'Doctor' }); setShowModal(true) }}
          >
            <PlusIcon />
            <span>Invite Team Member</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className="alert alert-success">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{toast}</span>
        </div>
      )}

      {/* ── RBAC Permissions Matrix Drawer (Collapsible) ── */}
      {showMatrix && (
        <div className="card p-5 shadow-lg space-y-4 animate-fadein" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h3 className="text-sm font-bold tracking-tight font-heading flex items-center gap-2 text-[var(--color-text)]">
                <span>Clinical Role-Based Access Control Matrix (RBAC)</span>
              </h3>
              <p className="text-[11px] text-[var(--color-text-muted)]">Statutory role scoping enforced server-side</p>
            </div>
            <button
              onClick={() => setShowMatrix(false)}
              className="text-xs cursor-pointer text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {Object.entries(ROLE_PERMISSIONS).map(([roleName, perms]) => (
              <div key={roleName} className="p-3 rounded-xl border space-y-2" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <div className="text-xs font-bold font-heading text-[var(--brand-primary)]">{roleName}</div>
                <div className="space-y-1">
                  {perms.map(p => (
                    <div key={p} className="text-[10px] flex items-center gap-1.5 text-[var(--color-text-secondary)]">
                      <span className="font-bold text-[var(--color-success)]">✓</span>
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Filter Tabs & Table ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-1.5 p-1 rounded-xl border w-fit" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
          {[
            { id: 'all', label: 'All Team Members' },
            { id: 'Active', label: 'Active Sessions' },
            { id: 'Invited', label: 'Pending Invitations' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id ? 'btn-primary' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
            </thead>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        ) : filteredStaff.length === 0 ? (
          <EmptyState
            icon={
              <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            }
            title="No staff members yet"
            description="Invite your first doctor or receptionist to get started."
            action={<button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>Invite first staff</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Staff directory">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email Address</th>
                  <th>Clinical Role</th>
                  <th>Status</th>
                  <th>Joined Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="avatar avatar-sm font-bold text-xs flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', color: '#fff' }}>
                          {getInitials(s.name)}
                        </div>
                        <span className="font-bold text-[var(--color-text)]">{s.name}</span>
                      </div>
                    </td>
                    <td className="mono text-[var(--color-text-secondary)]">{s.email}</td>
                    <td>
                      <Badge variant={s.role === 'Doctor' ? 'brand' : s.role === 'Pharmacist' ? 'warning' : 'info'}>
                        {s.role}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={s.status === 'Active' ? 'success' : 'warning'} dot>
                        {s.status}
                      </Badge>
                    </td>
                    <td className="text-[var(--color-text-muted)]">{fmtDate(s.joinedAt)}</td>
                    <td className="text-right">
                      {s.status === 'Invited' ? (
                        <button
                          onClick={() => copyInviteLink(s.email)}
                          className="btn btn-secondary btn-sm cursor-pointer"
                        >
                          Copy Invite Link
                        </button>
                      ) : (
                        <span className="text-[11px] font-semibold text-[var(--color-text-muted)]">Authorized</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invite Modal ── */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); reset({ name: '', email: '', role: 'Doctor' }); setSubmitError('') }}
        title="Invite Clinic Team Member"
        description="An invitation email with Azure Entra External ID onboarding will be dispatched."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => { setShowModal(false); reset() }} disabled={isSubmitting}>Cancel</button>
            <button form="invite-staff-form" type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Sending…' : 'Send invitation'}
            </button>
          </>
        }
      >
        {submitError && <div style={{ marginBottom: 16 }}><Alert variant="error" onDismiss={() => setSubmitError('')}>{submitError}</Alert></div>}

        <form id="invite-staff-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label htmlFor="staff-name" className="form-label">Full name *</label>
              <input id="staff-name" className="form-input" {...register('name')} placeholder="Dr. Priya Nair" />
              {errors.name && <p className="form-error">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="staff-email" className="form-label">Email address *</label>
              <input id="staff-email" type="email" className="form-input" {...register('email')} placeholder="doctor@clinic.com" />
              {errors.email && <p className="form-error">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="staff-role" className="form-label">Role *</label>
              <select id="staff-role" className="form-select" {...register('role')}>
                <option value="Doctor">Doctor</option>
                <option value="Receptionist">Receptionist</option>
                <option value="Pharmacist">Pharmacist</option>
                <option value="Nurse">Nurse</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}