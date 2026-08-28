import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import api from '../services/api'

const staffSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
  role: z.enum(['doctor', 'receptionist']),
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

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [showModal, setShowModal] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { name: '', email: '', role: 'doctor' },
  })

  const fetchStaff = useCallback(async () => {
    try {
      const res = await api.get('/staff')
      setStaff(res.data)
    } catch (err) {
      console.error('Failed to fetch staff:', err)
    }
  }, [])

  const onSubmit = useCallback(async (data: StaffForm) => {
    try {
      await api.post('/staff/invite', data)
      reset({ name: '', email: '', role: 'doctor' })
      setShowModal(false)
      fetchStaff()
    } catch (err: any) {
      console.error('Failed to create staff invite:', err)
      alert(err.response?.data?.error || 'Failed to create staff invite')
    }
  }, [fetchStaff])

  useEffect(() => {
    fetchStaff()
  }, [fetchStaff])

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="page-title">Staff Management</h1>
          <p className="page-subtitle">Invite and manage clinic staff</p>
        </div>
        <button onClick={() => { reset({ name: '', email: '', role: 'doctor' }); setShowModal(true); }} className="btn-primary">
          <PlusIcon className="w-5 h-5" aria-hidden="true" />
          Invite Staff
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl glass-card animate-scale-in">
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Invite New Staff</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="name" className="label">Full Name *</label>
                <input id="name" type="text" {...register('name')} className="input" placeholder="Dr. Smith" />
                {errors.name && <p className="text-sm text-rose-600 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label htmlFor="email" className="label">Email *</label>
                <input id="email" type="email" {...register('email')} className="input" placeholder="dr.smith@clinic.com" />
                {errors.email && <p className="text-sm text-rose-600 mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label htmlFor="role" className="label">Role *</label>
                <select id="role" {...register('role')} className="input">
                  <option value="doctor">Doctor</option>
                  <option value="receptionist">Receptionist</option>
                </select>
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
                {isSubmitting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
            <button type="button" onClick={() => { reset({ name: '', email: '', role: 'doctor' }); setShowModal(false); }} className="mt-4 text-sm text-slate-600 hover:underline w-full">Cancel</button>
          </div>
        </div>
      )}

      <div className="card-glass">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Staff List</h2>
          <p className="text-xs text-slate-500">Active members of the clinic team</p>
        </div>
        <div className="space-y-2">
          {staff.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No staff members invited yet</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th className="text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.name}</td>
                    <td><span className={`badge ${s.role === 'doctor' ? 'badge-primary' : 'badge-success'}`}>{s.role}</span></td>
                    <td>{new Date(s.joinedAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

function PlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}