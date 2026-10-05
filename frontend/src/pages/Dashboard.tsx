import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import ReceptionistDashboard from './dashboards/ReceptionistDashboard'
import DoctorDashboard from './dashboards/DoctorDashboard'
import AdminDashboard from './dashboards/AdminDashboard'
import PharmacistDashboard from './dashboards/PharmacistDashboard'
import NurseDashboard from './dashboards/NurseDashboard'

export type AppRole = 'receptionist' | 'doctor' | 'clinicadmin' | 'pharmacist' | 'nurse' | 'platformadmin'

export default function Dashboard() {
  const { user } = useAuth()
  
  // Base role from authenticated session
  const userActualRole: AppRole = useMemo(() => {
    const rawRole = (user?.role || 'doctor').toLowerCase()
    if (rawRole.includes('reception')) return 'receptionist'
    if (rawRole.includes('doc')) return 'doctor'
    if (rawRole.includes('pharm')) return 'pharmacist'
    if (rawRole.includes('nurse')) return 'nurse'
    if (rawRole.includes('platform')) return 'platformadmin'
    return 'clinicadmin'
  }, [user])

  // Admin or testing preview switcher state
  const [previewRole, setPreviewRole] = useState<AppRole>(userActualRole)

  // Use the previewRole if admin, otherwise strictly enforce actual session role
  const activeRole: AppRole = (userActualRole === 'clinicadmin' || userActualRole === 'platformadmin')
    ? previewRole
    : userActualRole

  const canSwitchPreview = userActualRole === 'clinicadmin' || userActualRole === 'platformadmin'

  return (
    <div className="space-y-4">
      {/* ── Admin & Governance Role Preview Bar ── */}
      {canSwitchPreview && (
        <div className="card p-2.5 bg-slate-900 text-slate-200 border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
            <span className="font-bold text-white uppercase tracking-wider text-[11px] font-mono">
              Role Perspective Switcher:
            </span>
            <span className="text-slate-400 text-[11px]">
              (Preview how each clinical team member experiences their operational dashboard)
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {([
              { id: 'clinicadmin' as AppRole, label: 'Clinic Admin', icon: '🏛️' },
              { id: 'doctor' as AppRole, label: 'Doctor EMR', icon: '🩺' },
              { id: 'receptionist' as AppRole, label: 'Receptionist OPD', icon: '🪑' },
              { id: 'pharmacist' as AppRole, label: 'Pharmacist', icon: '💊' },
              { id: 'nurse' as AppRole, label: 'Nurse Triage', icon: '💉' },
            ]).map(r => {
              const isSelected = activeRole === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setPreviewRole(r.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-teal-500 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Role Dashboard Component Dispatch ── */}
      {activeRole === 'receptionist' && <ReceptionistDashboard />}
      {activeRole === 'doctor' && <DoctorDashboard />}
      {activeRole === 'pharmacist' && <PharmacistDashboard />}
      {activeRole === 'nurse' && <NurseDashboard />}
      {(activeRole === 'clinicadmin' || activeRole === 'platformadmin') && <AdminDashboard />}
    </div>
  )
}
