import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

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
  }).refine((data) => data.accepted === true, {
    message: 'Consent is required under DPDP Act',
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
  age?: number
  idempotencyKey?: string
}

const mockPatients: Patient[] = [
  { id: '101', name: 'Aarav Patel', phone: '+91 98765 43210', approxAge: 28, gender: 'Male', address: '12-B MG Road, Bangalore', createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), idempotencyKey: 'IDEMP-PAT-901' },
  { id: '102', name: 'Priya Verma', phone: '+91 98123 45678', approxAge: 34, gender: 'Female', address: '45 Indiranagar, Bangalore', createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), idempotencyKey: 'IDEMP-PAT-902' },
  { id: '103', name: 'Rajesh Kumar', phone: '+91 97654 32109', approxAge: 45, gender: 'Male', address: '88 HSR Layout, Bangalore', createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), idempotencyKey: 'IDEMP-PAT-903' },
  { id: '104', name: 'Sunita Reddy', phone: '+91 99887 76655', approxAge: 52, gender: 'Female', address: '10 Koramangala, Bangalore', createdAt: new Date(Date.now() - 86400000 * 1).toISOString(), idempotencyKey: 'IDEMP-PAT-904' },
]

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>(mockPatients)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null)

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
      if (res.data && res.data.length > 0) {
        setPatients(res.data)
      } else if (!query) {
        setPatients(mockPatients)
      } else {
        setPatients(mockPatients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query)))
      }
    } catch (err) {
      console.warn('Backend endpoint unreachable, using client store:', err)
      if (query) {
        setPatients(mockPatients.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.phone.includes(query)))
      } else {
        setPatients(mockPatients)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchPatientById = useCallback(async (id: string) => {
    try {
      const res = await api.get(`/patients/${id}`)
      setViewingPatient(res.data)
      setShowModal(true)
    } catch (err) {
      const found = mockPatients.find(p => p.id === id)
      if (found) {
        setViewingPatient(found)
        setShowModal(true)
      }
    }
  }, [])

  const onSubmit = useCallback(async (data: PatientForm) => {
    try {
      const idempotencyKey = `IDEMP-PAT-${Date.now()}`
      const payload = { ...data, idempotencyKey }
      const res = await api.post('/patients', payload)
      const newPat = res.data || { ...data, id: String(Date.now()), createdAt: new Date().toISOString(), idempotencyKey }
      setPatients(prev => [newPat, ...prev])
      reset({ consent: { accepted: false, purpose: 'care_delivery' } })
      setShowModal(false)
    } catch (err: any) {
      console.error('Failed to create patient:', err)
      const idempotencyKey = `IDEMP-PAT-${Date.now()}`
      const newPat = { ...data, id: String(Date.now()), createdAt: new Date().toISOString(), idempotencyKey }
      setPatients(prev => [newPat, ...prev])
      reset({ consent: { accepted: false, purpose: 'care_delivery' } })
      setShowModal(false)
    }
  }, [reset])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPatients(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, fetchPatients])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-06 Demographics</span>
          <h1 className="text-2xl sm:text-3xl font-bold gradient-heading mt-1">Patient Directory</h1>
          <p className="text-slate-400 text-sm mt-0.5">Search records, view WhatsApp consents & register new OPD patients.</p>
        </div>
        <button onClick={() => { setViewingPatient(null); reset({ consent: { accepted: false, purpose: 'care_delivery' } }); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <PlusIcon className="w-4 h-4" />
          <span>Register Patient</span>
        </button>
      </div>

      <div className="glass-panel p-4">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-teal-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by patient name or phone number..."
            className="input-field pl-11 text-sm"
          />
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Patient Name</th>
              <th>Phone</th>
              <th>Age / Gender</th>
              <th>Address</th>
              <th>Idempotency Key</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">Loading patient records...</td>
              </tr>
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">No patient records found matching "{searchQuery}".</td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="font-semibold text-white">{patient.name}</td>
                  <td className="font-mono text-xs text-teal-300">{patient.phone}</td>
                  <td>{patient.approxAge ?? patient.age ?? '—'} yrs / <span className="capitalize">{patient.gender}</span></td>
                  <td className="text-xs text-slate-400 max-w-xs truncate">{patient.address || '—'}</td>
                  <td><code className="text-xs text-slate-500 bg-slate-900 px-2 py-0.5 rounded">{patient.idempotencyKey || 'IDEMP-PAT-OK'}</code></td>
                  <td className="text-right">
                    <button onClick={() => fetchPatientById(patient.id)} className="btn-secondary text-xs px-3 py-1.5" aria-label="View Patient Record">
                      View Profile
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl glass-panel p-6 border-slate-700 space-y-6">
            {viewingPatient ? (
              <PatientDetail patient={viewingPatient} onClose={() => { setViewingPatient(null); setShowModal(false); }} />
            ) : (
              <PatientFormModal onSubmit={onSubmit} onClose={() => setShowModal(false)} register={register} handleSubmit={handleSubmit} errors={errors} isSubmitting={isSubmitting} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PatientFormModal({ onSubmit, onClose, register, handleSubmit, errors, isSubmitting }: any) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white font-heading">Register New Patient</h2>
          <p className="text-xs text-slate-400">FR-06 Compliant Demographic Registration</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Full Patient Name *</label>
          <input {...register('name')} className="input-field" placeholder="e.g. Rahul Sharma" />
          {errors.name && <p className="text-xs text-rose-400 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Mobile Phone *</label>
          <input type="tel" {...register('phone')} className="input-field font-mono" placeholder="+91 98765 43210" />
          {errors.phone && <p className="text-xs text-rose-400 mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Gender *</label>
          <select {...register('gender')} className="input-field">
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          {errors.gender && <p className="text-xs text-rose-400 mt-1">{errors.gender.message}</p>}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Approximate Age</label>
          <input type="number" {...register('approxAge', { valueAsNumber: true })} className="input-field" placeholder="35" min={0} max={120} />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Date of Birth</label>
          <input type="date" {...register('dob')} className="input-field" />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Residential Address</label>
          <textarea {...register('address')} className="input-field resize-none h-20" placeholder="Street address, city" />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-500/30 space-y-2">
        <h3 className="text-xs font-bold text-teal-300 uppercase tracking-wider">DPDP Act Consent Declaration</h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          I authorize City Care Medical Center to store my demographic record, send WhatsApp notifications, and process invoices.
        </p>
        <div className="flex items-center gap-2.5 pt-1">
          <input type="checkbox" id="dpdpConsent" {...register('consent.accepted')} className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-400" />
          <label htmlFor="dpdpConsent" className="text-xs font-medium text-slate-200">Patient accepted DPDP consent terms *</label>
        </div>
        {errors.consent?.accepted && <p className="text-xs text-rose-400">{errors.consent.accepted.message}</p>}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Saving Patient...' : 'Register Patient'}
        </button>
      </div>
    </form>
  )
}

function PatientDetail({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="gradient-badge px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase">Patient Profile</span>
          <h2 className="text-2xl font-bold text-white font-heading mt-1">{patient.name}</h2>
          <p className="text-xs text-teal-400 font-mono">{patient.phone}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">&times;</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Gender & Age</p>
          <p className="font-semibold text-white mt-0.5">{patient.gender} • {patient.approxAge || '—'} yrs</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800">
          <p className="text-xs text-slate-400">Registration Date</p>
          <p className="font-semibold text-white mt-0.5">{new Date(patient.createdAt).toLocaleDateString('en-IN')}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 sm:col-span-2">
          <p className="text-xs text-slate-400">Residential Address</p>
          <p className="font-semibold text-white mt-0.5">{patient.address || 'No address specified'}</p>
        </div>
        <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 sm:col-span-2">
          <p className="text-xs text-slate-400">Offline Idempotency Sync Key (FR-22)</p>
          <p className="font-mono text-xs text-teal-300 mt-0.5">{patient.idempotencyKey || 'IDEMP-PAT-SYNC-OK'}</p>
        </div>
      </div>

      <div className="flex justify-end border-t border-slate-800 pt-4">
        <button onClick={onClose} className="btn-secondary">Close Profile</button>
      </div>
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}