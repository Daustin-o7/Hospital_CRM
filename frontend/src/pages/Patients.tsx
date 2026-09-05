import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert } from '../components/ui/Alert'
import { EmptyState, EmptySearch } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  dob: z.string().optional(),
  approxAge: z.string().optional(),
  gender: z.string().min(1, 'Gender is required'),
  address: z.string().optional(),
  consent: z.object({
    accepted: z.boolean().refine(v => v === true, 'Patient consent is required under DPDP Act'),
    purpose: z.string(),
  }),
})
type PatientForm = z.infer<typeof patientSchema>

interface Patient {
  id: string
  name: string
  phone: string
  dob?: string
  approxAge?: number
  gender: string
  address?: string
  createdAt: string
}

interface DuplicateMatch {
  id: string
  name: string
  dob?: string
  phoneLast4: string
  phone: string
  gender?: string
  address?: string
  score: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return '—' }
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Patient[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)
  const [submitError, setSubmitError] = useState('')
  
  // Duplicate Resolution State
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([])
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [pendingFormData, setPendingFormData] = useState<PatientForm | null>(null)
  const [isCreatingDuplicate, setIsCreatingDuplicate] = useState(false)

  const searchContainerRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { consent: { accepted: false, purpose: 'care_delivery' } },
  })

  const fetchPatients = useCallback(async (query = '') => {
    setLoading(true)
    try {
      const res = await api.get(`/patients/search?q=${encodeURIComponent(query)}`)
      setPatients(Array.isArray(res.data) ? res.data : [])
      if (query.trim()) setSearchResults(Array.isArray(res.data) ? res.data : [])
    } catch {
      setPatients([])
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const openPatient = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/patients/${id}`)
      setViewingPatient(res.data)
    } catch {
      const found = patients.find(p => p.id === id)
      if (found) setViewingPatient(found)
    }
  }, [patients])

  // Actual registration execution
  const executeRegistration = useCallback(async (data: PatientForm) => {
    const idempotencyKey = `IDEMP-PAT-${Date.now()}`
    const payload = {
      name: data.name,
      phone: data.phone,
      dob: data.dob ? data.dob : null,
      approxAge: data.approxAge ? Number(data.approxAge) : null,
      gender: data.gender,
      address: data.address || null,
      consent: {
        accepted: !!data.consent?.accepted,
        purpose: data.consent?.purpose || 'care_delivery'
      },
      idempotencyKey
    }

    try {
      const res = await api.post('/patients', payload)
      setPatients(prev => [res.data, ...prev])
      reset({ consent: { accepted: false, purpose: 'care_delivery' } })
      setShowRegister(false)
      setShowDuplicateModal(false)
      setPendingFormData(null)
      setDuplicateMatches([])
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Registration failed. Please check inputs.')
    } finally {
      setIsCreatingDuplicate(false)
    }
  }, [reset])

  const onSubmit = useCallback(async (data: PatientForm) => {
    setSubmitError('')
    // Step 1: Check for duplicates before creating
    try {
      const checkRes = await api.post('/patients/check-duplicate', {
        name: data.name,
        phone: data.phone,
        dob: data.dob ? data.dob : undefined
      })
      if (checkRes.data?.duplicate && Array.isArray(checkRes.data.matches) && checkRes.data.matches.length > 0) {
        setPendingFormData(data)
        setDuplicateMatches(checkRes.data.matches)
        setShowDuplicateModal(true)
        return
      }
    } catch {
      // If check fails or Typesense is in fallback, proceed to direct register
    }

    await executeRegistration(data)
  }, [executeRegistration])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  // Search dropdown effect - debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    setSearchLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/patients/search?q=${encodeURIComponent(searchQuery)}`)
        setSearchResults(Array.isArray(res.data) ? res.data : [])
        setShowSearchDropdown(true)
      } catch {
        setSearchResults([])
        setShowSearchDropdown(false)
      } finally {
        setSearchLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Click outside & Escape key listeners for search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const [filterType, setFilterType] = useState<'all' | 'today' | 'senior' | 'pediatric'>('all')

  const filteredPatients = patients.filter(p => {
    if (filterType === 'senior') return (p.approxAge || 0) >= 60
    if (filterType === 'pediatric') return (p.approxAge || 0) > 0 && (p.approxAge || 0) <= 12
    if (filterType === 'today') {
      const todayStr = new Date().toDateString()
      return new Date(p.createdAt).toDateString() === todayStr
    }
    return true
  })

  const hasSearch = searchQuery.trim().length > 0

  return (
    <div className="animate-fadein space-y-5">
      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              Patients
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200/70">
              DPDP 2023 Compliant
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {loading ? 'Synchronizing patient registry…' : `${patients.length} active patient profile${patients.length !== 1 ? 's' : ''} in electronic database`}
          </p>
        </div>
        <button
          id="register-patient-btn"
          className="btn btn-primary"
          onClick={() => { setSubmitError(''); setShowRegister(true) }}
          style={{ padding: '9px 18px', fontSize: '13px' }}
        >
          <PlusIcon />
          <span>New Patient Registration</span>
        </button>
      </div>

      {/* ── Search Bar & Filter Chips ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div ref={searchContainerRef} className="search-wrap relative" style={{ maxWidth: 460, width: '100%' }}>
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="patient-search"
            type="search"
            className="search-input"
            placeholder="Search by patient name, phone (+91), or UHID…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={() => searchQuery.trim() && setShowSearchDropdown(true)}
            aria-label="Search patients"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowSearchDropdown(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}

          {/* Search Results Dropdown with Composite Info & Quick Select */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden max-h-96 overflow-y-auto animate-fadein">
              {searchLoading ? (
                <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <span className="spinner spinner-sm" />
                  <span>Searching Typesense registry…</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div>
                  <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Disambiguated Matches</span>
                    <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">{searchResults.length} found</span>
                  </div>
                  {searchResults.map(r => (
                    <div
                      key={r.id}
                      className="w-full px-3.5 py-2.5 hover:bg-slate-50/80 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between gap-3 group"
                    >
                      <button
                        onClick={() => { setSearchQuery(r.name); setShowSearchDropdown(false); fetchPatients(r.name); }}
                        className="flex items-center gap-3 text-left flex-1 min-w-0"
                      >
                        <div className="avatar avatar-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', color: '#fff', fontWeight: 700, fontSize: '11px' }}>
                          {getInitials(r.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-sm truncate">{r.name}</div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            {r.dob && <span>DOB: {new Date(r.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                            {r.dob && r.phone && <span>•</span>}
                            {r.phone && <span className="mono font-medium">…{r.phone.slice(-4)}</span>}
                            <span className="capitalize text-slate-400">• {r.gender || '—'}</span>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => { setShowSearchDropdown(false); openPatient(r.id); }}
                        className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200/80 rounded-lg transition-colors flex-shrink-0"
                      >
                        Open Chart →
                      </button>
                    </div>
                  ))}
                </div>
              ) : searchQuery.trim().length >= 2 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No matching patients found for "{searchQuery}".
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Records', count: patients.length },
            { id: 'today', label: 'Registered Today', count: patients.filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString()).length },
            { id: 'senior', label: 'Senior (60+)', count: patients.filter(p => (p.approxAge || 0) >= 60).length },
            { id: 'pediatric', label: 'Pediatric (≤12)', count: patients.filter(p => (p.approxAge || 0) > 0 && (p.approxAge || 0) <= 12).length },
          ].map(chip => (
            <button
              key={chip.id}
              onClick={() => setFilterType(chip.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                filterType === chip.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <span>{chip.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${filterType === chip.id ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'}`}>
                {chip.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient Details</th>
                <th>Phone Number</th>
                <th>Demographics</th>
                <th>Registration Date</th>
                <th>Consent Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={6} />)}
            </tbody>
          </table>
        ) : filteredPatients.length === 0 ? (
          hasSearch
            ? <EmptySearch />
            : (
              <EmptyState
                icon={
                  <svg style={{ width: 48, height: 48 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
                title="No patients found"
                description={filterType !== 'all' ? `No patients matched the "${filterType}" filter criteria.` : "Register your first patient to begin electronic health records."}
                action={
                  <button className="btn btn-primary btn-sm" onClick={() => setShowRegister(true)}>
                    Register first patient
                  </button>
                }
              />
            )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" aria-label="Patient registry">
              <thead>
                <tr>
                  <th>Patient Profile</th>
                  <th>Primary Contact</th>
                  <th>Age & Gender</th>
                  <th>Registered On</th>
                  <th>DPDP Consent</th>
                  <th aria-label="Actions" style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openPatient(p.id)} className="hover:bg-slate-50/80 transition-colors">
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          className="avatar avatar-sm"
                          style={{
                            background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            boxShadow: '0 2px 6px rgba(13, 148, 136, 0.25)',
                          }}
                        >
                          {getInitials(p.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13.5px' }}>{p.name}</div>
                          <div className="mono" style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                            UHID-{p.id.slice(0, 8).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {p.phone}
                      </span>
                    </td>
                    <td>
                      {p.approxAge ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 text-xs">{p.approxAge} yrs</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500 font-medium capitalize">{p.gender}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 capitalize">{p.gender || '—'}</span>
                      )}
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '12.5px' }}>
                        {formatDate(p.createdAt)}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                        <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>Consented</span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); openPatient(p.id) }}
                        aria-label={`View ${p.name}`}
                        style={{ padding: '4px 10px', fontSize: '12px', color: 'var(--brand-primary)', fontWeight: 600 }}
                      >
                        View Chart →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Register Patient Modal ── */}
      <Modal
        open={showRegister}
        onClose={() => { setShowRegister(false); reset({ consent: { accepted: false, purpose: 'care_delivery' } }); setSubmitError('') }}
        title="Register New Patient Profile"
        description="Add a new individual to the hospital registry with statutory DPDP 2023 explicit consent."
      >
        {submitError && (
          <div style={{ marginBottom: 16 }}>
            <Alert variant="error" onDismiss={() => setSubmitError('')}>{submitError}</Alert>
          </div>
        )}

        <form id="register-patient-form" onSubmit={handleSubmit(onSubmit as any)} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Full name */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="reg-name" className="form-label">Full Legal Name *</label>
              <input id="reg-name" className="form-input" {...register('name')} placeholder="e.g. Ramesh Chandra Verma" />
              {errors.name && <p className="form-error">{errors.name.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="reg-phone" className="form-label">Phone Number *</label>
              <input id="reg-phone" className="form-input" {...register('phone')} type="tel" placeholder="+91 98765 43210" />
              {errors.phone && <p className="form-error">{errors.phone.message}</p>}
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="reg-gender" className="form-label">Gender Identity *</label>
              <select id="reg-gender" className="form-select" {...register('gender')}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
              {errors.gender && <p className="form-error">{errors.gender.message}</p>}
            </div>

            {/* DOB */}
            <div>
              <label htmlFor="reg-dob" className="form-label">Date of Birth</label>
              <input id="reg-dob" className="form-input" {...register('dob')} type="date" />
            </div>

            {/* Approx age */}
            <div>
              <label htmlFor="reg-age" className="form-label">Approximate Age (years)</label>
              <input id="reg-age" className="form-input" {...register('approxAge')} type="number" min="0" max="150" placeholder="e.g. 35" />
            </div>

            {/* Address */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="reg-address" className="form-label">Residential Address</label>
              <textarea id="reg-address" className="form-textarea" {...register('address')} rows={2} placeholder="House / Flat No, Street, City, Pincode" style={{ minHeight: 64 }} />
            </div>

            {/* Consent */}
            <div style={{ gridColumn: '1 / -1', padding: '14px 16px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  id="reg-consent"
                  type="checkbox"
                  {...register('consent.accepted')}
                  style={{ marginTop: 3, accentColor: 'var(--brand-primary)', width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ fontSize: '12.5px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  <strong>Digital Personal Data Protection (DPDP) Consent:</strong> Patient or legal guardian has provided explicit verbal/written authorization to collect, store, and process medical data strictly for <strong>direct clinical care delivery</strong>.
                </span>
              </label>
              {errors.consent?.accepted && (
                <p className="form-error" style={{ marginTop: 6 }}>{errors.consent.accepted.message}</p>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowRegister(false); reset({ consent: { accepted: false, purpose: 'care_delivery' } }) }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              id="submit-patient-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Registering Patient…' : 'Complete Registration'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Duplicate Resolution Modal (FR-06 Disambiguation Gate) ── */}
      <Modal
        open={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Potential Duplicate Patient Detected"
        description="A patient with matching details already exists in the electronic registry. Please review below."
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">Duplicate Prevention Active</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                We found existing records that match the name, contact number, or birth date you entered.
              </p>
            </div>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {duplicateMatches.map(match => (
              <div
                key={match.id}
                className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs hover:border-teal-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar avatar-md flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)', color: '#fff', fontWeight: 700 }}>
                    {getInitials(match.name)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm truncate">{match.name}</span>
                      <span className="mono text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200/60">
                        UHID-{match.id.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-1">
                      {match.dob && <span>DOB: {new Date(match.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      {match.phone && <span className="mono">Phone: ••••• {match.phoneLast4 || match.phone.slice(-4)}</span>}
                      {match.gender && <span className="capitalize">{match.gender}</span>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setShowRegister(false)
                    openPatient(match.id)
                  }}
                  className="btn btn-primary btn-sm whitespace-nowrap self-end sm:self-center"
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  Use Existing Chart →
                </button>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowDuplicateModal(false)}
            >
              Cancel & Edit Info
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm text-slate-600 hover:text-slate-900 font-semibold"
              disabled={isCreatingDuplicate}
              onClick={() => {
                if (pendingFormData) {
                  setIsCreatingDuplicate(true)
                  executeRegistration(pendingFormData)
                }
              }}
            >
              {isCreatingDuplicate ? 'Creating…' : 'Proceed as New Patient'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── View Patient Modal ── */}
      <Modal
        open={!!viewingPatient}
        onClose={() => setViewingPatient(null)}
        title="Electronic Health Record"
        description={viewingPatient ? `Patient Chart · UHID-${viewingPatient.id.slice(0, 8).toUpperCase()}` : ''}
      >
        {viewingPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Header banner */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  className="avatar avatar-lg"
                  style={{
                    background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    boxShadow: '0 4px 10px rgba(13, 148, 136, 0.3)',
                  }}
                >
                  {getInitials(viewingPatient.name)}
                </div>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-heading)' }}>
                    {viewingPatient.name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="mono text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200/60">
                      UHID-{viewingPatient.id.slice(0, 8).toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 font-medium">
                      {viewingPatient.approxAge ? `${viewingPatient.approxAge} yrs` : 'Age N/A'} · {viewingPatient.gender}
                    </span>
                  </div>
                </div>
              </div>
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Consent Status</span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active Care Delivery
                </span>
              </div>
            </div>

            {/* Quick Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white border border-slate-200/70 rounded-2xl">
              {[
                { label: 'Primary Contact', value: viewingPatient.phone, mono: true },
                { label: 'Gender Identity', value: viewingPatient.gender },
                { label: 'Age / Demographic', value: viewingPatient.approxAge ? `${viewingPatient.approxAge} years` : 'Not recorded' },
                { label: 'Date of Birth', value: viewingPatient.dob ? formatDate(viewingPatient.dob) : 'Not specified' },
                { label: 'First Registered', value: formatDate(viewingPatient.createdAt) },
                { label: 'Residential City', value: viewingPatient.address || 'Standard local residency' },
              ].map(f => (
                <div key={f.label} className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100">
                  <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>
                    {f.label}
                  </div>
                  <div className={`${f.mono ? 'mono' : ''} text-slate-900 font-semibold text-xs mt-1 truncate`}>
                    {f.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Patient Clinical Quick Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Ready for next clinical interaction</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingPatient(null)}
                  className="btn btn-secondary btn-sm"
                >
                  Close Chart
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
    </svg>
  )
}