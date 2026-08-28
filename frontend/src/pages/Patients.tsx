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
    message: 'Consent is required',
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
}

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([])
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
      setPatients(res.data)
    } catch (err) {
      console.error('Failed to fetch patients:', err)
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
      console.error('Failed to fetch patient:', err)
    }
  }, [])

  const onSubmit = useCallback(async (data: PatientForm) => {
    try {
      await api.post('/patients', data)
      reset({ consent: { accepted: false, purpose: 'care_delivery' } })
      setShowModal(false)
      fetchPatients(searchQuery)
    } catch (err: any) {
      console.error('Failed to create patient:', err)
      if (err.response?.data?.possibleDuplicateOf) {
        alert('Possible duplicate patient found. Please check existing records.')
      }
    }
  }, [fetchPatients, searchQuery])

  useEffect(() => {
    fetchPatients()
  }, [fetchPatients])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 3) {
        fetchPatients(searchQuery)
      } else if (searchQuery === '') {
        fetchPatients()
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, fetchPatients])

  const handleOpenRegister = () => {
    reset({ consent: { accepted: false, purpose: 'care_delivery' } })
    setShowModal(true)
  }

  const handleView = (patient: Patient) => {
    fetchPatientById(patient.id)
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Patients</h1>
          <p className="page-subtitle">Manage patient records and demographics</p>
        </div>
        <button onClick={handleOpenRegister} className="btn-primary">
          <PlusIcon className="w-5 h-5" aria-hidden="true" />
          Register Patient
        </button>
      </div>

      <div className="card-glass mb-6">
        <div className="relative max-w-md">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone (min 3 chars)..."
            className="input pl-12"
          />
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Registered</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="py-8 text-center">
                    <div className="flex justify-center gap-2">
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100}ms` }} />
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100 + 100}ms` }} />
                      <div className="w-4 h-4 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: `${i * 100 + 200}ms` }} />
                    </div>
                  </td>
                </tr>
              ))
            ) : patients.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  {searchQuery.length > 0 && searchQuery.length < 3 ? (
                    'Type at least 3 characters to search'
                  ) : searchQuery.length >= 3 ? (
                    'No patients found. '
                  ) : (
                    'No patients registered yet. '
                  )}
                  <button onClick={handleOpenRegister} className="text-primary-600 hover:underline ml-1">
                    Register new patient
                  </button>
                </td>
              </tr>
            ) : (
              patients.map((patient) => (
                <tr key={patient.id}>
                  <td className="font-medium">{patient.name}</td>
                  <td>{patient.phone}</td>
                  <td>{patient.age ?? patient.approxAge ?? patient.dob ? new Date().getFullYear() - new Date(patient.dob || '').getFullYear() : '—'}</td>
                  <td><span className="badge-slate">{patient.gender}</span></td>
                  <td className="text-slate-500">{new Date(patient.createdAt).toLocaleDateString()}</td>
                  <td className="text-right">
                    <button onClick={() => handleView(patient)} className="btn-ghost p-1.5" aria-label="View patient">
                      <EyeIcon className="w-5 h-5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className={`w-full max-w-${viewingPatient ? '2xl' : 'lg'} max-h-[90vh] overflow-y-auto glass-card animate-scale-in`}>
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
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-900">Register New Patient</h2>
        <button type="button" onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
          <XIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="name" className="label">Full Name *</label>
          <input id="name" {...register('name')} className="input" placeholder="John Doe" />
          {errors.name && <p className="text-sm text-rose-600 mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label htmlFor="phone" className="label">Phone *</label>
          <input id="phone" type="tel" {...register('phone')} className="input" placeholder="+91 98765 43210" />
          {errors.phone && <p className="text-sm text-rose-600 mt-1">{errors.phone.message}</p>}
        </div>

        <div>
          <label htmlFor="gender" className="label">Gender *</label>
          <select id="gender" {...register('gender')} className="input">
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
          {errors.gender && <p className="text-sm text-rose-600 mt-1">{errors.gender.message}</p>}
        </div>

        <div>
          <label htmlFor="dob" className="label">Date of Birth</label>
          <input id="dob" type="date" {...register('dob')} className="input" max={new Date().toISOString().split('T')[0]} />
        </div>

        <div>
          <label htmlFor="approxAge" className="label">Approximate Age</label>
          <input id="approxAge" type="number" {...register('approxAge', { valueAsNumber: true })} className="input" placeholder="e.g., 45" min={0} max={120} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="address" className="label">Address</label>
          <textarea id="address" {...register('address')} className="input min-h-[100px] resize-y" placeholder="Optional" />
        </div>
      </div>

      <div className="border-t border-slate-100 pt-6 space-y-4">
        <h3 className="text-lg font-medium text-slate-900">Consent (DPDP Act)</h3>
        <p className="text-sm text-slate-600">
          I consent to the collection and processing of my personal health information for the purpose of care delivery and appointment/billing records.
        </p>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="consent"
            {...register('consent.accepted')}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            required
          />
          <label htmlFor="consent" className="text-sm text-slate-700">
            I understand and accept the consent terms <span className="text-rose-600">*</span>
          </label>
        </div>
        {errors.consent?.accepted && <p className="text-sm text-rose-600 ml-7">{errors.consent.accepted.message}</p>}
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
        <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="btn-primary">
          {isSubmitting ? 'Registering...' : 'Register Patient'}
        </button>
      </div>
    </form>
  )
}

function PatientDetail({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{patient.name}</h2>
          <p className="text-slate-500 text-sm">{patient.phone}</p>
        </div>
        <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close">
          <XIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 border-t border-slate-100 pt-6">
        <div>
          <p className="text-sm text-slate-500">Gender</p>
          <p className="font-medium">{patient.gender}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Age</p>
          <p className="font-medium">{patient.age ?? patient.approxAge ?? '—'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Date of Birth</p>
          <p className="font-medium">{patient.dob ? new Date(patient.dob).toLocaleDateString() : 'Not provided'}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">Registered</p>
          <p className="font-medium">{new Date(patient.createdAt).toLocaleDateString()}</p>
        </div>
        {patient.address && (
          <div className="sm:col-span-2">
            <p className="text-sm text-slate-500">Address</p>
            <p className="font-medium">{patient.address}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <button onClick={onClose} className="btn-secondary">Close</button>
      </div>
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
}
function XIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}
function EyeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}
function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}