import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert, friendlyError } from '../components/ui/Alert'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'
import { fmtDate } from '../utils/format'
import { useAuth } from '../context/AuthContext'

interface Shift {
  id: string
  date: string
  shiftType: 'Morning' | 'Evening' | 'Night'
  status: 'Open' | 'Assigned' | 'Cancelled'
  notes: string
  nurseProfileId: string | null
  nurseName: string | null
  appliedCount: number
  appliedByMe?: boolean
}

interface NurseOption { id: string; name: string; email: string; designation?: string }
interface Applicant {
  id: string; nurseProfileId: string; nurseName: string; designation?: string; specialization?: string
}
interface LeaveRow {
  id: string; startDate: string; endDate: string; type: string; status: string; reason: string
  nurseProfileId?: string; nurseName?: string
}

const SHIFT_TYPES = ['Morning', 'Evening', 'Night'] as const
const LEAVE_TYPES = ['Sick', 'Casual', 'Vacation', 'Unpaid'] as const

const shiftBadge = (s: Shift['status']) =>
  s === 'Assigned' ? 'success' : s === 'Open' ? 'warning' : 'neutral'
const leaveBadge = (s: string) =>
  s === 'Approved' ? 'success' : s === 'Rejected' ? 'danger' : s === 'Cancelled' ? 'neutral' : 'warning'

export default function NurseRoster() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['clinicadmin'])
  const isNurse = hasRole(['nurse'])

  const [shifts, setShifts] = useState<Shift[]>([])
  const [nurses, setNurses] = useState<NurseOption[]>([])
  const [myLeaves, setMyLeaves] = useState<LeaveRow[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRow[]>([])
  const [myProfileId, setMyProfileId] = useState<string | null>(null)
  const [balance, setBalance] = useState<{ totalDays: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [showPost, setShowPost] = useState(false)
  const [postDate, setPostDate] = useState('')
  const [postType, setPostType] = useState<string>('Morning')
  const [postNotes, setPostNotes] = useState('')
  const [postNurse, setPostNurse] = useState('')
  const [saving, setSaving] = useState(false)

  const [applicantsFor, setApplicantsFor] = useState<Shift | null>(null)
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [cancelTarget, setCancelTarget] = useState<Shift | null>(null)

  const [showLeave, setShowLeave] = useState(false)
  const [leaveStart, setLeaveStart] = useState('')
  const [leaveEnd, setLeaveEnd] = useState('')
  const [leaveType, setLeaveType] = useState<string>('Sick')
  const [leaveReason, setLeaveReason] = useState('')
  const [reviewNote, setReviewNote] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [shiftRes, leaveReq] = await Promise.all([
        api.get('/shifts'),
        isNurse ? api.get('/staff/me/nurse-profile').catch(() => null) : Promise.resolve(null),
      ])
      setShifts(shiftRes.data)

      if (leaveReq?.data) {
        setMyProfileId(leaveReq.data.id)
        const [lv, bal] = await Promise.all([
          api.get(`/staff/nurses/${leaveReq.data.id}/leave`).catch(() => ({ data: [] })),
          api.get(`/staff/leave-balances/${leaveReq.data.id}`).catch(() => null),
        ])
        setMyLeaves(lv.data)
        if (bal?.data) setBalance(bal.data)
      }

      if (isAdmin) {
        const [nl, pl] = await Promise.all([
          api.get('/staff/nurses').catch(() => ({ data: [] })),
          api.get('/staff/leave-requests?status=Pending').catch(() => ({ data: [] })),
        ])
        setNurses(nl.data)
        setPendingLeaves(pl.data)
      }
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }, [isAdmin, isNurse])

  useEffect(() => { load() }, [load])

  const postShift = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post('/shifts', {
        date: postDate,
        shiftType: postType,
        notes: postNotes || null,
        nurseProfileId: postNurse || null,
      })
      setShowPost(false)
      setPostDate(''); setPostNotes(''); setPostNurse(''); setPostType('Morning')
      showToast('Shift posted')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const applyForShift = async (shift: Shift) => {
    setError('')
    try {
      await api.post(`/shifts/${shift.id}/applications`)
      showToast('Application sent — the admin will confirm your slot')
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const withdrawShift = async (shift: Shift) => {
    setError('')
    try {
      await api.post(`/shifts/${shift.id}/applications/withdraw`)
      showToast('Application withdrawn — re-apply any time while the shift is open')
      load()
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const openApplicants = async (shift: Shift) => {
    setApplicantsFor(shift)
    setApplicants([])
    try {
      const res = await api.get(`/shifts/${shift.id}/applications`)
      setApplicants(res.data)
    } catch (err) {
      setError(friendlyError(err))
    }
  }

  const selectApplicant = async (applicationId: string) => {
    if (!applicantsFor) return
    setSaving(true)
    try {
      await api.post(`/shifts/${applicantsFor.id}/applications/${applicationId}/select`)
      setApplicantsFor(null)
      showToast('Nurse assigned to shift')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const cancelShift = async () => {
    if (!cancelTarget) return
    setSaving(true)
    try {
      await api.put(`/shifts/${cancelTarget.id}`, { cancel: true })
      setCancelTarget(null)
      showToast('Shift cancelled')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const requestLeave = async () => {
    if (!myProfileId) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/staff/nurses/${myProfileId}/leave`, {
        startDate: leaveStart,
        endDate: leaveEnd,
        type: leaveType,
        reason: leaveReason,
      })
      setShowLeave(false)
      setLeaveStart(''); setLeaveEnd(''); setLeaveReason('')
      showToast('Leave request submitted')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const reviewLeave = async (leaveId: string, status: 'Approved' | 'Rejected') => {
    setSaving(true)
    try {
      const res = await api.post(`/staff/leave-requests/${leaveId}/review`, { status, note: reviewNote || null })
      const conflicts = res.data.rosterConflicts?.length ?? 0
      showToast(status === 'Approved' && conflicts > 0
        ? `Leave approved — ${conflicts} roster shift(s) clash, review the roster`
        : `Leave ${status.toLowerCase()}`)
      setReviewNote('')
      load()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6 pb-12 animate-fadein">
      {/* ── Header ── */}
      <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
              MOD-26 Nurse Staffing
            </span>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">Roster · Leave · Handover</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight font-heading mt-1 text-[var(--color-text)]">
            Nurse Roster &amp; Leave
          </h1>
          <p className="text-xs font-medium mt-0.5 text-[var(--color-text-muted)]">
            {loading ? 'Loading…' : `${shifts.filter(s => s.status !== 'Cancelled').length} shifts in the current window${balance ? ` · ${balance.totalDays} leave days taken this year` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {isNurse && myProfileId && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowLeave(true)}>
              Request leave
            </button>
          )}
          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => { setError(''); setShowPost(true) }}>
              + Post shift
            </button>
          )}
        </div>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError('')}>{error}</Alert>}
      {toast && <div className="alert alert-success"><span>{toast}</span></div>}

      {/* ── Roster ── */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-sm font-bold font-heading text-[var(--color-text)]">Shift roster</h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">Today ± window</span>
        </div>

        {loading ? (
          <table className="data-table">
            <thead><tr><th>Date</th><th>Shift</th><th>Nurse</th><th>Status</th><th></th></tr></thead>
            <tbody>{Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}</tbody>
          </table>
        ) : shifts.length === 0 ? (
          <EmptyState
            title="No shifts scheduled"
            description={isAdmin ? 'Post the first shift to start the roster.' : 'The admin has not posted shifts yet.'}
            action={isAdmin ? <button className="btn btn-primary btn-sm" onClick={() => setShowPost(true)}>Post shift</button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table" aria-label="Nurse shift roster">
              <thead>
                <tr>
                  <th>Date</th><th>Shift</th><th>Nurse</th><th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map(s => (
                  <tr key={s.id} className={s.appliedByMe ? 'bg-teal-50/60 dark:bg-teal-950/30' : ''}>
                    <td className="text-[var(--color-text)]">{fmtDate(s.date)}</td>
                    <td>
                      <Badge variant={s.shiftType === 'Night' ? 'info' : 'brand'}>{s.shiftType}</Badge>
                      {s.notes && <span className="ml-2 text-[11px] text-[var(--color-text-muted)]">{s.notes}</span>}
                    </td>
                    <td className="text-[var(--color-text-secondary)]">
                      {s.nurseName ?? '—'}
                      {s.appliedByMe && <span className="ml-2 text-[11px] font-semibold text-teal-700 dark:text-teal-300">(you)</span>}
                    </td>
                    <td><Badge variant={shiftBadge(s.status)} dot>{s.status}</Badge></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && s.status === 'Open' && s.appliedCount > 0 && (
                          <button className="btn btn-secondary btn-sm" onClick={() => openApplicants(s)}>
                            Applicants ({s.appliedCount})
                          </button>
                        )}
                        {isNurse && s.status === 'Open' && (
                          s.appliedByMe ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-teal-700 dark:text-teal-300">Applied</span>
                              <button className="btn btn-ghost btn-sm" onClick={() => withdrawShift(s)}>Withdraw</button>
                            </span>
                          ) : (
                            <button className="btn btn-primary btn-sm" onClick={() => applyForShift(s)}>Apply</button>
                          )
                        )}
                        {isAdmin && s.status !== 'Cancelled' && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setCancelTarget(s)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Leave ── */}
      {isNurse && myProfileId && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold font-heading text-[var(--color-text)] border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            My leave requests
          </h2>
          {myLeaves.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">No leave requests yet.</p>
          ) : (
            <ul className="space-y-2">
              {myLeaves.map(l => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="mono text-[13px] text-[var(--color-text)]">{fmtDate(l.startDate)} → {fmtDate(l.endDate)}</span>
                  <Badge variant="neutral">{l.type}</Badge>
                  <Badge variant={leaveBadge(l.status)} dot>{l.status}</Badge>
                  {l.reason && <span className="text-[var(--color-text-muted)]">— {l.reason}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold font-heading text-[var(--color-text)] border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
            Pending leave requests
          </h2>
          {pendingLeaves.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Nothing awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map(l => (
                <div key={l.id} className="flex flex-wrap items-center gap-3 p-3 rounded-xl border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                  <div className="flex-1 min-w-[200px]">
                    <div className="text-sm font-semibold text-[var(--color-text)]">{l.nurseName}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                      {fmtDate(l.startDate)} → {fmtDate(l.endDate)} · {l.type}
                      {l.reason ? ` · ${l.reason}` : ''}
                    </div>
                  </div>
                  <input
                    className="form-input !w-40 text-xs"
                    placeholder="Note (optional)"
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    aria-label="Review note"
                  />
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => reviewLeave(l.id, 'Approved')}>
                    Approve
                  </button>
                  <button className="btn btn-secondary btn-sm" disabled={saving} onClick={() => reviewLeave(l.id, 'Rejected')}>
                    Reject
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Post shift modal ── */}
      <Modal
        open={showPost}
        onClose={() => setShowPost(false)}
        title="Post a shift"
        description="Open shifts can receive nurse applications; assign directly to skip applications."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowPost(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={postShift} disabled={saving || !postDate}>
              {saving && <span className="spinner spinner-sm" />}
              {saving ? 'Posting…' : 'Post shift'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="shift-date" className="form-label">Date *</label>
            <input id="shift-date" type="date" className="form-input" min={today} value={postDate} onChange={e => setPostDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="shift-type" className="form-label">Shift *</label>
            <select id="shift-type" className="form-select" value={postType} onChange={e => setPostType(e.target.value)}>
              {SHIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="shift-nurse" className="form-label">Assign nurse (optional — leave empty to post as open)</label>
            <select id="shift-nurse" className="form-select" value={postNurse} onChange={e => setPostNurse(e.target.value)}>
              <option value="">Open shift — nurses can apply</option>
              {nurses.map(n => <option key={n.id} value={n.id}>{n.name}{n.designation ? ` — ${n.designation}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="shift-notes" className="form-label">Notes</label>
            <input id="shift-notes" className="form-input" value={postNotes} onChange={e => setPostNotes(e.target.value)} placeholder="Ward cover, treatment room, etc." />
          </div>
        </div>
      </Modal>

      {/* ── Applicants modal ── */}
      <Modal
        open={applicantsFor !== null}
        onClose={() => setApplicantsFor(null)}
        title="Applicants"
        description={applicantsFor ? `${fmtDate(applicantsFor.date)} · ${applicantsFor.shiftType}` : ''}
        footer={<button className="btn btn-secondary" onClick={() => setApplicantsFor(null)}>Close</button>}
      >
        {applicants.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">No applications yet.</p>
        ) : (
          <ul className="space-y-2">
            {applicants.map(a => (
              <li key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border" style={{ background: 'var(--color-surface-raised)', borderColor: 'var(--color-border)' }}>
                <div>
                  <div className="text-sm font-semibold text-[var(--color-text)]">{a.nurseName}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {a.designation || 'Nurse'}{a.specialization ? ` · ${a.specialization}` : ''}
                  </div>
                </div>
                {a.id && (
                  <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => selectApplicant(a.id)}>
                    {saving ? 'Assigning…' : 'Assign'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* ── Cancel confirm modal ── */}
      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel shift?"
        description={cancelTarget ? `${fmtDate(cancelTarget.date)} · ${cancelTarget.shiftType}${cancelTarget.nurseName ? ` · ${cancelTarget.nurseName}` : ' (open)'}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCancelTarget(null)} disabled={saving}>Keep it</button>
            <button className="btn btn-primary" onClick={cancelShift} disabled={saving}>
              {saving ? 'Cancelling…' : 'Cancel shift'}
            </button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          The shift is marked cancelled and any applications on it stop counting. This cannot be undone from the UI.
        </p>
      </Modal>

      {/* ── Request leave modal ── */}
      <Modal
        open={showLeave}
        onClose={() => setShowLeave(false)}
        title="Request leave"
        description="Your admin reviews the request; roster clashes are flagged automatically."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowLeave(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={requestLeave} disabled={saving || !leaveStart || !leaveEnd}>
              {saving && <span className="spinner spinner-sm" />}
              {saving ? 'Submitting…' : 'Submit request'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="leave-from" className="form-label">From *</label>
              <input id="leave-from" type="date" className="form-input" value={leaveStart} onChange={e => setLeaveStart(e.target.value)} />
            </div>
            <div>
              <label htmlFor="leave-to" className="form-label">To *</label>
              <input id="leave-to" type="date" className="form-input" min={leaveStart || today} value={leaveEnd} onChange={e => setLeaveEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <label htmlFor="leave-type" className="form-label">Type *</label>
            <select id="leave-type" className="form-select" value={leaveType} onChange={e => setLeaveType(e.target.value)}>
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="leave-reason" className="form-label">Reason</label>
            <input id="leave-reason" className="form-input" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="Optional context for your admin" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
