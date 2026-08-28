import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

interface WorkingHour {
  day: string
  shiftIndex: number
  open: string
  close: string
}

interface Holiday {
  id: string
  name: string
  startDate: string
  endDate: string
  recurringAnnually: boolean
  internalNote: string | null
}

interface SpecialHour {
  id: string
  date: string
  open: string
  close: string
  reason: string | null
}

interface ClinicProfile {
  name: string
  organizationType: string | null
  legalName: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  timezone: string
  currency: string
  dateFormat: string
  timeFormat: string
  language: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  defaultAppointmentDurationMinutes: number
  bufferMinutes: number
  minAdvanceBookingHours: number
  maxAdvanceBookingDays: number
  sameDayBookingAllowed: boolean
  walkInsAllowed: boolean
  overbookingAllowed: boolean
  cancellationWindowHours: number
  reschedulingAllowed: boolean
  queueEnabled: boolean
  invoicePrefix: string
  defaultGstRate: number
  workingHours: WorkingHour[]
  holidays: Holiday[]
  specialHours: SpecialHour[]
}

const ALL_DAYS = [
  { key: 'sunday', label: 'Sunday' },
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
]

export default function Settings() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const userRole = String(user?.role || 'doctor').toLowerCase()
  const isAdmin = userRole === 'clinicadmin'

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/clinic/profile')
      setProfile(res.data)
    } catch {
      showToast('Failed to load clinic profile', 'err')
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const onUpdateProfile = async () => {
    if (!profile) return
    setLoading(true)
    try {
      await api.put('/clinic/profile', { name: profile.name })
      showToast('Clinic profile saved')
    } catch {
      showToast('Failed to save profile', 'err')
    } finally {
      setLoading(false)
    }
  }

  const onSaveHours = async (hours: WorkingHour[]) => {
    setLoading(true)
    try {
      await api.put('/clinic/hours', { workingHours: hours })
      showToast('Working hours saved')
      fetchProfile()
    } catch {
      showToast('Failed to save working hours', 'err')
    } finally {
      setLoading(false)
    }
  }

  const onAddHoliday = async (name: string, start: string, end: string, recurring: boolean) => {
    try {
      await api.post('/clinic/holidays', {
        name,
        startDate: start,
        endDate: end,
        recurringAnnually: recurring,
      })
      showToast('Holiday added')
      fetchProfile()
    } catch {
      showToast('Failed to add holiday', 'err')
    }
  }

  const onDeleteHoliday = async (id: string) => {
    try {
      await api.delete(`/clinic/holidays/${id}`)
      showToast('Holiday removed')
      fetchProfile()
    } catch {
      showToast('Failed to remove holiday', 'err')
    }
  }

  const onAddSpecialHour = async (date: string, open: string, close: string, reason: string) => {
    try {
      await api.post('/clinic/special-hours', { date, open, close, reason })
      showToast('Special hour added')
      fetchProfile()
    } catch {
      showToast('Failed to add special hour', 'err')
    }
  }

  const onDeleteSpecialHour = async (id: string) => {
    try {
      await api.delete(`/cllinic/special-hours/${id}`)
      showToast('Special hour removed')
      fetchProfile()
    } catch {
      showToast('Failed to remove special hour', 'err')
    }
  }

  if (!profile) {
    return (
      <div className="animate-fadein">
        <div className="page-header">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-description">Clinic profile, operating hours, holidays, and configuration.</p>
          </div>
        </div>
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14 }}>
          <span className="spinner spinner-lg" style={{ margin: '0 auto 16px' }} />
          <div>Loading clinic settings…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fadein" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description">
            {isAdmin
              ? 'Configure clinic profile, working hours, holidays, and operating rules.'
              : 'Read-only view of clinic operating hours, holidays, and configuration.'}
          </p>
        </div>
        {!isAdmin && (
          <span className="badge badge-info">Read-only</span>
        )}
      </div>

      {/* ── Toast notifications ── */}
      {toast && (
        <div className={`alert alert-${toast.kind === 'ok' ? 'success' : 'error'}`} role="alert">
          <span>{toast.msg}</span>
        </div>
      )}

      <WorkingHoursEditor
        initialHours={profile.workingHours}
        isAdmin={isAdmin}
        onSave={onSaveHours}
        saving={loading}
      />

      <HolidaysEditor
        holidays={profile.holidays}
        isAdmin={isAdmin}
        onAdd={onAddHoliday}
        onDelete={onDeleteHoliday}
      />

      <SpecialHoursEditor
        specialHours={profile.specialHours}
        isAdmin={isAdmin}
        onAdd={onAddSpecialHour}
        onDelete={onDeleteSpecialHour}
      />

      <ClinicProfileEditor
        profile={profile}
        isAdmin={isAdmin}
        onUpdate={setProfile}
        onSave={onUpdateProfile}
        saving={loading}
      />
    </div>
  )
}

function WorkingHoursEditor({ initialHours, isAdmin, onSave, saving }: {
  initialHours: WorkingHour[]
  isAdmin: boolean
  onSave: (hours: WorkingHour[]) => void
  saving: boolean
}) {
  const [hours, setHours] = useState<WorkingHour[]>(initialHours)

  useEffect(() => {
    setHours(initialHours)
  }, [initialHours])

  const hoursByDay = hours.reduce((acc, h) => {
    if (!acc[h.day]) acc[h.day] = []
    acc[h.day].push(h)
    return acc
  }, {} as Record<string, WorkingHour[]>)

  const updateShift = (day: string, shiftIndex: number, field: 'open' | 'close', value: string) => {
    const next = hours.map(h =>
      h.day === day && h.shiftIndex === shiftIndex ? { ...h, [field]: value } : h
    )
    setHours(next)
  }

  const addShift = (day: string) => {
    const existing = hoursByDay[day] || []
    const nextShiftIndex = existing.length
    setHours([...hours, { day, shiftIndex: nextShiftIndex, open: '09:00', close: '18:00' }])
  }

  const removeShift = (day: string, shiftIndex: number) => {
    const filtered = hours.filter(h => !(h.day === day && h.shiftIndex === shiftIndex))
    // Re-index remaining shifts for this day
    const reindexed: WorkingHour[] = []
    let dayShifts: WorkingHour[] = []
    for (const h of filtered) {
      if (h.day === day) dayShifts.push(h)
      else reindexed.push(h)
    }
    dayShifts = dayShifts.map((h, idx) => ({ ...h, shiftIndex: idx }))
    setHours([...reindexed, ...dayShifts])
  }

  const enableDay = (day: string) => {
    setHours([...hours, { day, shiftIndex: 0, open: '09:00', close: '18:00' }])
  }

  const handleSave = () => onSave(hours)

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Working Hours (FR-07 / FR-10)</h2>
        {isAdmin && hours.length > 0 && (
          <button onClick={handleSave} disabled={saving} className="btn-primary text-xs">
            {saving ? 'Saving...' : 'Save Hours'}
          </button>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Each day can have one or more shifts (e.g. split shifts 09:00–13:00 and 14:00–18:00).
        <span className="font-semibold"> Sunday is fully configurable </span> — it is not hard-coded as closed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {ALL_DAYS.map(d => {
          const dayShifts = hoursByDay[d.key] || []
          return (
            <div key={d.key} className="rounded-xl border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{d.label}</span>
                {dayShifts.length === 0 && isAdmin && (
                  <button
                    onClick={() => enableDay(d.key)}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700"
                  >
                    + Open on {d.label}
                  </button>
                )}
                {dayShifts.length > 0 && isAdmin && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    Open · {dayShifts.length} shift{dayShifts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {dayShifts.length === 0 && (
                <p className="text-xs text-slate-500">Closed</p>
              )}
              {dayShifts.map(s => (
                <div key={s.shiftIndex} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={s.open}
                    onChange={e => updateShift(d.key, s.shiftIndex, 'open', e.target.value)}
                    disabled={!isAdmin}
                    className="input-field text-xs py-1 px-2 mono disabled:bg-slate-100"
                  />
                  <span className="text-xs text-slate-500">to</span>
                  <input
                    type="time"
                    value={s.close}
                    onChange={e => updateShift(d.key, s.shiftIndex, 'close', e.target.value)}
                    disabled={!isAdmin}
                    className="input-field text-xs py-1 px-2 mono disabled:bg-slate-100"
                  />
                  {isAdmin && (
                    <button
                      onClick={() => removeShift(d.key, s.shiftIndex)}
                      className="text-xs text-rose-600 hover:text-rose-800"
                      title="Remove shift"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {isAdmin && dayShifts.length > 0 && (
                <button
                  onClick={() => addShift(d.key)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  + Add shift
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HolidaysEditor({ holidays, isAdmin, onAdd, onDelete }: {
  holidays: Holiday[]
  isAdmin: boolean
  onAdd: (name: string, start: string, end: string, recurring: boolean) => void
  onDelete: (id: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [recurring, setRecurring] = useState(false)

  const handleAdd = () => {
    if (!name || !start || !end) return
    onAdd(name, start, end, recurring)
    setName('')
    setStart('')
    setEnd('')
    setRecurring(false)
    setShowAdd(false)
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Holidays &amp; Closures</h2>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs">
            {showAdd ? 'Cancel' : '+ Add Holiday'}
          </button>
        )}
      </div>

      {showAdd && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Holiday Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-field"
                placeholder="Diwali"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={e => setRecurring(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Recurs annually</span>
              </label>
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
          <button onClick={handleAdd} className="btn-primary text-xs">Save Holiday</button>
        </div>
      )}

      {holidays.length === 0 ? (
        <p className="text-xs text-slate-500">No holidays configured.</p>
      ) : (
        <div className="space-y-2">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-semibold text-slate-900">{h.name}</p>
                <p className="text-xs text-slate-500 mono">
                  {h.startDate}{h.startDate !== h.endDate ? ` to ${h.endDate}` : ''}
                  {h.recurringAnnually && ' · annual'}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(h.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SpecialHoursEditor({ specialHours, isAdmin, onAdd, onDelete }: {
  specialHours: SpecialHour[]
  isAdmin: boolean
  onAdd: (date: string, open: string, close: string, reason: string) => void
  onDelete: (id: string) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [date, setDate] = useState('')
  const [open, setOpen] = useState('10:00')
  const [close, setClose] = useState('14:00')
  const [reason, setReason] = useState('')

  const handleAdd = () => {
    if (!date) return
    onAdd(date, open, close, reason)
    setDate('')
    setReason('')
    setShowAdd(false)
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Special Opening Days</h2>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} className="btn-secondary text-xs">
            {showAdd ? 'Cancel' : '+ Add Special Hour'}
          </button>
        )}
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Override the normal weekly schedule for a specific date (e.g. a Sunday that's normally closed but open for a special clinic).
      </p>

      {showAdd && (
        <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Reason (optional)</label>
              <input
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="input-field"
                placeholder="Special Sunday clinic"
              />
            </div>
            <div>
              <label className="label">Open Time</label>
              <input
                type="time"
                value={open}
                onChange={e => setOpen(e.target.value)}
                className="input-field mono"
              />
            </div>
            <div>
              <label className="label">Close Time</label>
              <input
                type="time"
                value={close}
                onChange={e => setClose(e.target.value)}
                className="input-field mono"
              />
            </div>
          </div>
          <button onClick={handleAdd} className="btn-primary text-xs">Save Special Hour</button>
        </div>
      )}

      {specialHours.length === 0 ? (
        <p className="text-xs text-slate-500">No special opening days configured.</p>
      ) : (
        <div className="space-y-2">
          {specialHours.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div>
                <p className="text-sm font-semibold text-amber-900 mono">{s.date}</p>
                <p className="text-xs text-amber-700 mono">
                  {s.open} – {s.close}
                  {s.reason && ` · ${s.reason}`}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClinicProfileEditor({ profile, isAdmin, onUpdate, onSave, saving }: {
  profile: ClinicProfile
  isAdmin: boolean
  onUpdate: (p: ClinicProfile) => void
  onSave: () => void
  saving: boolean
}) {
  const update = (field: keyof ClinicProfile, value: any) => {
    onUpdate({ ...profile, [field]: value })
  }

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="section-title">Clinic Profile</h2>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Organization details used across invoices, prescriptions, and communications.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Clinic Name *</label>
          <input
            value={profile.name}
            onChange={e => update('name', e.target.value)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="label">Organization Type</label>
          <select
            value={profile.organizationType || ''}
            onChange={e => update('organizationType', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
          >
            <option value="">— Select —</option>
            <option value="Clinic">Clinic</option>
            <option value="Hospital">Hospital</option>
            <option value="Diagnostic Center">Diagnostic Center</option>
            <option value="Polyclinic">Polyclinic</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="label">Legal Name</label>
          <input
            value={profile.legalName || ''}
            onChange={e => update('legalName', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="label">Timezone</label>
          <input
            value={profile.timezone}
            onChange={e => update('timezone', e.target.value)}
            disabled={!isAdmin}
            className="input-field mono disabled:bg-slate-50"
            placeholder="Asia/Kolkata"
          />
        </div>
        <div>
          <label className="label">Currency</label>
          <select
            value={profile.currency}
            onChange={e => update('currency', e.target.value)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
          >
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
            <option value="GBP">GBP (£)</option>
            <option value="AED">AED (د.إ)</option>
            <option value="SGD">SGD (S$)</option>
          </select>
        </div>
        <div>
          <label className="label">Language</label>
          <select
            value={profile.language}
            onChange={e => update('language', e.target.value)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
          >
            <option value="en">English</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Address</label>
          <textarea
            value={profile.address || ''}
            onChange={e => update('address', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field disabled:bg-slate-50"
            rows={2}
          />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            value={profile.phone || ''}
            onChange={e => update('phone', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field mono disabled:bg-slate-50"
            placeholder="+91 80 2345 6789"
          />
        </div>
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            value={profile.email || ''}
            onChange={e => update('email', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field mono disabled:bg-slate-50"
          />
        </div>
        <div>
          <label className="label">Website</label>
          <input
            value={profile.website || ''}
            onChange={e => update('website', e.target.value || null)}
            disabled={!isAdmin}
            className="input-field mono disabled:bg-slate-50"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Branding</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Primary Color</label>
            <input
              type="color"
              value={profile.primaryColor}
              onChange={e => update('primaryColor', e.target.value)}
              disabled={!isAdmin}
              className="input-field h-10"
            />
          </div>
          <div>
            <label className="label">Secondary Color</label>
            <input
              type="color"
              value={profile.secondaryColor}
              onChange={e => update('secondaryColor', e.target.value)}
              disabled={!isAdmin}
              className="input-field h-10"
            />
          </div>
          <div>
            <label className="label">Accent Color</label>
            <input
              type="color"
              value={profile.accentColor}
              onChange={e => update('accentColor', e.target.value)}
              disabled={!isAdmin}
              className="input-field h-10"
            />
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Appointment Defaults</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label">Duration (min)</label>
            <input
              type="number"
              min="5"
              max="120"
              value={profile.defaultAppointmentDurationMinutes}
              onChange={e => update('defaultAppointmentDurationMinutes', Number(e.target.value))}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="label">Buffer (min)</label>
            <input
              type="number"
              min="0"
              max="60"
              value={profile.bufferMinutes}
              onChange={e => update('bufferMinutes', Number(e.target.value))}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="label">Min Advance (hrs)</label>
            <input
              type="number"
              min="0"
              value={profile.minAdvanceBookingHours}
              onChange={e => update('minAdvanceBookingHours', Number(e.target.value))}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="label">Max Advance (days)</label>
            <input
              type="number"
              min="1"
              value={profile.maxAdvanceBookingDays}
              onChange={e => update('maxAdvanceBookingDays', Number(e.target.value))}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.sameDayBookingAllowed}
              onChange={e => update('sameDayBookingAllowed', e.target.checked)}
              disabled={!isAdmin}
              className="w-4 h-4"
            />
            <span>Same-day booking</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.walkInsAllowed}
              onChange={e => update('walkInsAllowed', e.target.checked)}
              disabled={!isAdmin}
              className="w-4 h-4"
            />
            <span>Walk-ins allowed</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={profile.reschedulingAllowed}
              onChange={e => update('reschedulingAllowed', e.target.checked)}
              disabled={!isAdmin}
              className="w-4 h-4"
            />
            <span>Rescheduling allowed</span>
          </label>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-200">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Billing Defaults</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Invoice Prefix</label>
            <input
              value={profile.invoicePrefix}
              onChange={e => update('invoicePrefix', e.target.value)}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="label">Default GST Rate (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={profile.defaultGstRate}
              onChange={e => update('defaultGstRate', Number(e.target.value))}
              disabled={!isAdmin}
              className="input-field mono disabled:bg-slate-50"
            />
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="flex justify-end pt-4 border-t border-slate-200">
          <button onClick={onSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Clinic Profile'}
          </button>
        </div>
      )}
    </div>
  )
}