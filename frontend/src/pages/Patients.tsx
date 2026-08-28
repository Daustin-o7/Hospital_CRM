import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'
import { Modal } from '../components/ui/Modal'
import { Alert, friendlyError } from '../components/ui/Alert'
import { EmptyState, EmptySearch } from '../components/ui/EmptyState'
import { SkeletonRow } from '../components/ui/Skeleton'

// ── Schema ────────────────────────────────────────────────────────────────────
const patientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  dob: z.string().optional(),
  approxAge: z.number().optional(),
  gender: z.string().min(1, 'Gender is required'),
  address: z.string().optional(),
  consent: z.object({
    accepted: z.boolean(),
    purpose: z.string().min(1, 'Purpose is required'),
  }).refine(d => d.accepted === true, {
    message: 'Patient consent is required under DPDP Act',
    path: ['accepted'],
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
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)
  const [submitError, setSubmitError] = useState('')

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
    } catch {
      setPatients([])
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

  const onSubmit = useCallback(async (data: PatientForm) => {
    setSubmitError('')
    try {
      const idempotencyKey = `IDEMP-PAT-${Date.now()}`
      const res = await api.post('/patients', { ...data, idempotencyKey })
      setPatients(prev => [res.data, ...prev])
      reset({ consent: { accepted: false, purpose: 'care_delivery' } })
      setShowRegister(false)
    } catch (err: any) {
      setSubmitError(friendlyError(err))
    }
  }, [reset])

  useEffect(() => { fetchPatients() }, [fetchPatients])

  useEffect(() => {
    const t = setTimeout(() => fetchPatients(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, fetchPatients])

  const hasSearch = searchQuery.trim().length > 0

  return (
    <div className="animate-fadein">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-description">
            {loading ? 'Loading patient records…' : `${patients.length} patient${patients.length !== 1 ? 's' : ''} in registry`}
          </p>
        </div>
        <button
          id="register-patient-btn"
          className="btn btn-primary"
          onClick={() => { setSubmitError(''); setShowRegister(true) }}
        >
          <PlusIcon />
          Register patient
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ marginBottom: 16 }}>
        <div className="search-wrap" style={{ maxWidth: 380 }}>
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            id="patient-search"
            type="search"
            className="search-input"
            placeholder="Search by name or phone…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            aria-label="Search patients"
          />
        </div>
      </div>

      {/* ── Table card ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Phone</th>
                <th>Age / Gender</th>
                <th>Registered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
            </tbody>
          </table>
        ) : patients.length === 0 ? (
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
                title="No patients yet"
                description="Register your first patient to get started with the clinic registry."
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
                  <th>Patient</th>
                  <th>Phone</th>
                  <th>Age / Gender</th>
                  <th>Registered</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {patients.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => openPatient(p.id)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm">{getInitials(p.name)}</div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: 13.5 }}>{p.name}</div>
                          <div className="mono" style={{ color: 'var(--color-text-muted)' }}>ID-{p.id.slice(0, 8).toUpperCase()}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="mono">{p.phone}</span>
                    </td>
                    <td>
                      {p.approxAge ? (
                        <span style={{ color: 'var(--color-text-secondary)' }}>
                          {p.approxAge}y · {p.gender}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--color-text-muted)' }}>{formatDate(p.createdAt)}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={e => { e.stopPropagation(); openPatient(p.id) }}
                        aria-label={`View ${p.name}`}
                        style={{ padding: '5px 10px', fontSize: 12.5, color: 'var(--brand-primary)' }}
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

      {/* ── Register Patient Modal ── */}
      <Modal
        open={showRegister}
        onClose={() => { setShowRegister(false); reset({ consent: { accepted: false, purpose: 'care_delivery' } }); setSubmitError('') }}
        title="Register new patient"
        description="Patient data is stored securely under DPDP Act compliance."
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => { setShowRegister(false); reset({ consent: { accepted: false, purpose: 'care_delivery' } }) }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              form="register-patient-form"
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting && <span className="spinner spinner-sm" />}
              {isSubmitting ? 'Registering…' : 'Register patient'}
            </button>
          </>
        }
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
              <label htmlFor="reg-name" className="form-label">Full name *</label>
              <input id="reg-name" className="form-input" {...register('name')} placeholder="Patient's full name" />
              {errors.name && <p className="form-error">{errors.name.message}</p>}
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="reg-phone" className="form-label">Phone number *</label>
              <input id="reg-phone" className="form-input" {...register('phone')} type="tel" placeholder="+91 98765 43210" />
              {errors.phone && <p className="form-error">{errors.phone.message}</p>}
            </div>

            {/* Gender */}
            <div>
              <label htmlFor="reg-gender" className="form-label">Gender *</label>
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
              <label htmlFor="reg-dob" className="form-label">Date of birth</label>
              <input id="reg-dob" className="form-input" {...register('dob')} type="date" />
            </div>

            {/* Approx age */}
            <div>
              <label htmlFor="reg-age" className="form-label">Approximate age</label>
              <input id="reg-age" className="form-input" {...register('approxAge')} type="number" min="0" max="150" placeholder="e.g. 35" />
            </div>

            {/* Address */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="reg-address" className="form-label">Address</label>
              <textarea id="reg-address" className="form-textarea" {...register('address')} rows={2} placeholder="Street, City" style={{ minHeight: 64 }} />
            </div>

            {/* Consent */}
            <div style={{ gridColumn: '1 / -1', padding: '12px 14px', background: 'var(--color-info-bg)', border: '1px solid var(--color-info-border)', borderRadius: 'var(--radius-md)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                <input
                  id="reg-consent"
                  type="checkbox"
                  {...register('consent.accepted')}
                  style={{ marginTop: 2, accentColor: 'var(--brand-primary)', width: 14, height: 14, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Patient has provided verbal or written consent to collect and process their health data for <strong>care delivery</strong> under the DPDP Act, 2023.
                </span>
              </label>
              {errors.consent?.accepted && (
                <p className="form-error" style={{ marginTop: 6 }}>{errors.consent.accepted.message}</p>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ── View Patient Modal ── */}
      <Modal
        open={!!viewingPatient}
        onClose={() => setViewingPatient(null)}
        title="Patient record"
        description={viewingPatient?.name}
      >
        {viewingPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div className="avatar avatar-lg">{getInitials(viewingPatient.name)}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{viewingPatient.name}</div>
                <div className="mono" style={{ color: 'var(--color-text-muted)', marginTop: 2 }}>ID-{viewingPatient.id.slice(0, 8).toUpperCase()}</div>
              </div>
            </div>

            <hr className="divider" />

            <dl style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {[
                { label: 'Phone', value: viewingPatient.phone },
                { label: 'Gender', value: viewingPatient.gender },
                { label: 'Age', value: viewingPatient.approxAge ? `${viewingPatient.approxAge} years` : '—' },
                { label: 'Date of birth', value: viewingPatient.dob ? formatDate(viewingPatient.dob) : '—' },
                { label: 'Address', value: viewingPatient.address || '—' },
                { label: 'Registered', value: formatDate(viewingPatient.createdAt) },
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
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}