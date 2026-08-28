import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['Doctor', 'Receptionist']),
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

const mockStaff: StaffMember[] = [
  { id: 'st-01', name: 'Dr. R. K. Sharma', email: 'dr.sharma@citycare.com', role: 'Doctor', status: 'Active', joinedAt: new Date(Date.now() - 86400000 * 90).toISOString() },
  { id: 'st-02', name: 'Dr. Ananya Iyer', email: 'dr.iyer@citycare.com', role: 'Doctor', status: 'Active', joinedAt: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: 'st-03', name: 'Sunil Mehta', email: 'reception@citycare.com', role: 'Receptionist', status: 'Active', joinedAt: new Date(Date.now() - 86400000 * 30).toISOString() },
]

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>(mockStaff)
  const [showModal, setShowModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', role: 'Doctor' },
  })

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get('/staff')
      if (res.data && res.data.length > 0) setStaff(res.data)
      else setStaff(mockStaff)
    } catch {
      setStaff(mockStaff)
    }
  }, [])

  const onSubmit = useCallback(async (data: StaffForm) => {
    try {
      await api.post('/staff/invite', data)
      const newStaff: StaffMember = {
        id: `st-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        status: 'Invited',
        joinedAt: new Date().toISOString()
      }
      setStaff(prev => [newStaff, ...prev])
      reset({ name: '', email: '', role: 'Doctor' })
      setShowModal(false)
    } catch {
      const newStaff: StaffMember = {
        id: `st-${Date.now()}`,
        name: data.name,
        email: data.email,
        role: data.role,
        status: 'Invited',
        joinedAt: new Date().toISOString()
      }
      setStaff(prev => [newStaff, ...prev])
      reset({ name: '', email: '', role: 'Doctor' })
      setShowModal(false)
    }
  }, [reset])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="gradient-badge px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">FR-02 Staff Onboarding</span>
          <h1 className="page-title mt-1">Clinic Staff Directory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>Manage doctor profiles, receptionists &amp; send invitation tokens.</p>
        </div>
        <button onClick={() => { reset({ name: '', email: '', role: 'Doctor' }); setShowModal(true); }} className="btn-primary">
          <PlusIcon className="w-4 h-4" />
          <span>Invite New Staff</span>
        </button>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="section-title">Active Clinic Personnel</h2>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-slate-900">{s.name}</td>
                  <td className="mono text-xs text-slate-700">{s.email}</td>
                  <td>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                      {s.role}
                    </span>
                  </td>
                  <td>
                    <span className={s.status === 'Active' ? 'status-chip status-chip-completed' : 'status-chip status-chip-pending'}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-xs text-slate-500">{new Date(s.joinedAt).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md card p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 font-heading">Invite Staff Member</h2>
                <p className="text-xs text-slate-500">FR-02 Email Invite Token</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Full Name *</label>
                <input {...register('name')} className="input-field" placeholder="e.g. Dr. Priya Nair" />
                {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Email Address *</label>
                <input type="email" {...register('email')} className="input-field mono" placeholder="doctor@citycare.com" />
                {errors.email && <p className="text-xs text-rose-600 mt-1">{errors.email.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Assigned Role *</label>
                <select {...register('role')} className="input-field">
                  <option value="Doctor">Doctor</option>
                  <option value="Receptionist">Receptionist</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  {isSubmitting ? 'Sending Invite...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}