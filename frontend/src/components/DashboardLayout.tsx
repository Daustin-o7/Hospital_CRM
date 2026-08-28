import { useState } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon, roles: ['ClinicAdmin', 'Doctor', 'Receptionist'] },
  { name: 'Patients', href: '/dashboard/patients', icon: UsersIcon, roles: ['ClinicAdmin', 'Doctor', 'Receptionist'] },
  { name: 'Appointments', href: '/dashboard/appointments', icon: CalendarIcon, roles: ['ClinicAdmin', 'Doctor', 'Receptionist'] },
  { name: 'Consultations', href: '/dashboard/consultations', icon: FileTextIcon, roles: ['Doctor', 'ClinicAdmin'] },
  { name: 'Billing & Invoices', href: '/dashboard/billing', icon: CreditCardIcon, roles: ['ClinicAdmin', 'Doctor', 'Receptionist'] },
  { name: 'Staff Management', href: '/dashboard/staff', icon: UserPlusIcon, roles: ['ClinicAdmin'] },
  { name: 'Clinic Settings', href: '/dashboard/settings', icon: SettingsIcon, roles: ['ClinicAdmin'] },
]

function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11a2 2 0 110 4 2 2 0 010-4z" /></svg>
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function CalendarIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
}
function FileTextIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
}
function CreditCardIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
}
function UserPlusIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{"name":"Dr. Sharma","role":"Doctor","email":"doctor@samstack.ai"}')
  const userRole = user?.role || 'Doctor'

  const filteredNav = navigation.filter(item => item.roles.includes(userRole))

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-[#070c18] text-slate-100 flex flex-col">
      {/* Mobile Drawer Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" aria-hidden="true">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 shadow-2xl p-6 z-50">
            <Sidebar nav={filteredNav} user={user} userRole={userRole} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:w-72 lg:flex lg:flex-col glass-panel border-r border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <Sidebar nav={filteredNav} user={user} userRole={userRole} />
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-72 flex flex-col flex-1 min-h-screen">
        {/* Top Navbar */}
        <header className="sticky top-0 z-30 bg-slate-900/75 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-4">
              <button
                className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-teal-400">SamStack AI CRM</span>
                <h1 className="text-lg font-bold text-white hidden sm:block">City Care Medical Center</h1>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/60">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-medium text-slate-200">{user?.name}</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-950 text-teal-300 border border-teal-700/50">
                  {userRole}
                </span>
              </div>

              <button
                onClick={handleLogout}
                className="btn-secondary flex items-center gap-2 text-xs py-2 px-3 hover:text-rose-300 hover:border-rose-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 p-6 lg:p-10 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Sidebar({ nav, user, userRole, onClose }: { nav: typeof navigation; user: any; userRole: string; onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full p-5 justify-between">
      <div>
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-800/80">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
            +
          </div>
          <div>
            <h2 className="font-bold text-white tracking-tight text-lg">SamStack AI</h2>
            <p className="text-xs text-teal-400 font-medium">Doctor & Clinic CRM</p>
          </div>
        </div>

        <nav className="space-y-1.5" aria-label="Main navigation">
          {nav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-950/80 to-slate-900 text-teal-300 border-l-4 border-teal-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`
              }
              onClick={onClose}
              end={item.href === '/dashboard'}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="pt-4 border-t border-slate-800/80">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/40 border border-slate-800">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0).toUpperCase() || 'D'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-200 truncate">{user?.name || 'Dr. Sharma'}</p>
            <p className="text-xs text-slate-400 truncate">{userRole}</p>
          </div>
        </div>
      </div>
    </div>
  )
}