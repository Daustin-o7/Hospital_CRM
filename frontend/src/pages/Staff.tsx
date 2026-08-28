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
  role:  z.enum(['Doctor', 'Receptionist']),
})
type StaffForm = z.infer<typeof staffSchema>

interface StaffMember {
  id: string; name: string; email: string; role: string; status: string; joinedAt: string
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
  const [staff, setStaff]           = useState<StaffMember[]>([])
  const [loading, setLoading]       = useState(true)
  const [showModal, setShowModal]   = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', role: 'Doctor' },
  })

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/v1/staff')
      setStaff(Array.isArray(res.data) ? res.data : [])
    } catch {
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [])

  const onSubmit = useCallback(async (data: StaffForm) => {
    setSubmitError('')
    try {
      await api.post('/v1/staff/invite', data)
      setStaff(prev => [{
        id: `st-${Date.now()}`, name: data.name, email: data.email,
        role: data.role, status: 'Invited', joinedAt: new Date().toISOString(),
      }, ...prev])
      reset({ name: '', email: '', role: 'Doctor' })
      setShowModal(false)
    } catch (err: any) {
      setSubmitError(friendlyError(err))
    }
  }, [reset])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const doctors       = staff.filter(s => s.role === 'Doctor')
  const receptionists = staff.filter(s => s.role === 'Receptionist')

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff directory</h1>
          <p className="page-description">
            {loading ? 'Loading…' : `${staff.length} team member${staff.length !== 1 ? 's' : ''} · ${doctors.length} doctor${doctors.length !== 1 ? 's' : ''} · ${receptionists.length} reception`}
          </p>
        </div>
        <button
          id="invite-staff-btn"
          className="btn btn-primary"
          onClick={() => { setSubmitError(''); reset({ name: '', email: '', role: 'Doctor' }); setShowModal(true) }}
        >
          <PlusIcon />
          Invite staff
        </button>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th></tr>
            </thead>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        ) : staff.length === 0 ? (
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
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Staff directory">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm">{getInitials(s.name)}</div>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{s.name}</span>
                      </div>
                    </td>
                    <td><span className="mono">{s.email}</span></td>
                    <td>
                      <Badge variant={s.role === 'Doctor' ? 'brand' : 'info'}>{s.role}</Badge>
                    </td>
                    <td>
                      <Badge variant={s.status === 'Active' ? 'success' : 'warning'} dot>
                        {s.status}
                      </Badge>
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{fmtDate(s.joinedAt)}</td>
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
        title="Invite staff member"
        description="An invitation email will be sent to the provided address."
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