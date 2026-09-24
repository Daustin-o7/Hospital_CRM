import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useBranding } from '../context/BrandingContext'
import { useAuth } from '../context/AuthContext'
import { ThemeToggle } from './ui/ThemeToggle'

// ── Navigation definition ────────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    end: true,
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: HomeIcon,
  },
  {
    name: 'Appointments',
    href: '/dashboard/appointments',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: CalendarIcon,
  },
  {
    name: 'Patients',
    href: '/dashboard/patients',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: UsersIcon,
  },
  {
    name: 'Queue',
    href: '/dashboard/queue',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: QueueIcon,
  },
  {
    name: 'Consultations',
    href: '/dashboard/consultations',
    roles: ['doctor', 'clinicadmin'],
    icon: FileTextIcon,
  },
  {
    name: 'Billing',
    href: '/dashboard/billing',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: CreditCardIcon,
  },
  {
    name: 'Pharmacy POS',
    href: '/dashboard/pharmacy/pos',
    roles: ['clinicadmin', 'pharmacist', 'doctor', 'receptionist'],
    icon: ShoppingBagIcon,
  },
  {
    name: 'Drug Batches',
    href: '/dashboard/pharmacy/batches',
    roles: ['clinicadmin', 'pharmacist', 'doctor'],
    icon: PillIcon,
  },
  {
    name: 'Drug Compliance',
    href: '/dashboard/pharmacy/compliance',
    roles: ['clinicadmin', 'pharmacist', 'doctor'],
    icon: ShieldCheckIcon,
  },
  {
    name: 'Inventory',
    href: '/dashboard/inventory',
    roles: ['clinicadmin', 'doctor', 'receptionist', 'nurse'],
    icon: BoxIcon,
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    roles: ['clinicadmin', 'doctor', 'pharmacist'],
    icon: BarChartIcon,
  },
  {
    name: 'Messages',
    href: '/dashboard/messages',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: MailIcon,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    roles: ['clinicadmin', 'doctor', 'receptionist', 'pharmacist'],
    icon: SettingsIcon,
  },
]

const ROLE_LABEL: Record<string, string> = {
  clinicadmin:   'Administrator',
  doctor:        'Doctor',
  receptionist:  'Receptionist',
  pharmacist:    'Pharmacist',
  nurse:         'Nurse',
  platformadmin: 'Platform Admin',
}

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { branding } = useBranding()
  const { user, logout } = useAuth()

  const rawRole = String(user?.role || 'doctor').toLowerCase()
  const displayRole = ROLE_LABEL[rawRole] ?? (user?.role || 'Staff')
  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(rawRole))

  useEffect(() => { setSidebarOpen(false); setShowNotifications(false) }, [location.pathname])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        const el = document.getElementById('global-search-input') as HTMLInputElement | null
        el?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/dashboard/patients?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex text-[var(--color-text)] font-sans antialiased selection:bg-teal-500 selection:text-white transition-colors duration-200">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop & Mobile Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0b131e] text-[#dbe3f3] flex flex-col border-r border-[#22364f]/80 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#22364f]/80 flex items-center justify-between bg-[#070f19]/90 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            {branding.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={branding.organizationName}
                className="w-9 h-9 rounded-xl object-cover ring-1 ring-[#2dd4bf]/40 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0d5c63] via-[#14b8a6] to-[#0b131e] border border-[#2dd4bf]/40 flex items-center justify-center text-white font-bold shadow-md shadow-teal-950/60">
                <svg className="w-5 h-5 text-[#2dd4bf]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-4H7v-2h4V7h2v4h4v2h-4v4z"/>
                </svg>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-bold text-[#f8fafc] tracking-tight truncate font-heading">
                {branding.organizationName || 'SAMSTACK AI'}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] animate-pulse" />
                <p className="text-[10px] uppercase font-bold tracking-wider text-[#2dd4bf] truncate font-mono">
                  <span>Clinical Precision</span>
                </p>
              </div>
            </div>
          </div>
          {sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#111e2e]"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#899294] font-mono">
            Clinical Modules
          </div>
          {filteredNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-150 group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#0d5c63] to-[#14b8a6] text-[#f8fafc] border border-[#2dd4bf]/40 shadow-lg shadow-teal-950/40 font-bold'
                    : 'text-slate-200 hover:text-white hover:bg-[#111e2e]/90 hover:border hover:border-[#22364f]/60'
                }`
              }
            >
              <item.icon className="w-4 h-4 text-teal-400 group-hover:text-teal-300 transition-transform group-hover:scale-110 shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}

          {/* Quick Actions Section */}
          <div className="pt-4 mt-4 border-t border-[#22364f]/80">
            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#899294] font-mono">
              Fast Shortcuts
            </div>
            <div className="space-y-1 mt-1">
              <button
                onClick={() => navigate('/dashboard/appointments')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#111e2e]/70 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_#2dd4bf]"></span>
                <span>Today's OPD Queue</span>
              </button>
              <button
                onClick={() => navigate('/dashboard/patients')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#111e2e]/70 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
                <span>Register Patient</span>
              </button>
              <button
                onClick={() => navigate('/dashboard/pharmacy/pos')}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:text-white hover:bg-[#111e2e]/70 transition-colors text-left"
              >
                <span className="w-2 h-2 rounded-full bg-[#5eead4] shadow-[0_0_8px_#5eead4]"></span>
                <span>Pharmacy Fast POS</span>
              </button>
            </div>
          </div>

          {/* Mobile Theme Switcher inside Drawer */}
          <div className="lg:hidden pt-4 mt-4 border-t border-[#22364f]/80 px-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#899294] font-mono mb-2">
              Appearance Theme
            </div>
            <ThemeToggle variant="segmented" className="w-full justify-between" />
          </div>
        </nav>

        {/* User Footer Card */}
        <div className="p-3 border-t border-[#22364f]/80 bg-[#070f19]/90">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#111e2e]/90 border border-[#22364f] shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-[#0d5c63] text-[#2dd4bf] border border-[#2dd4bf]/40 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-[#f8fafc] truncate tracking-tight font-heading">
                {user?.name || 'Dr. Arjun Mehta'}
              </div>
              <div className="text-[10px] text-[#2dd4bf] font-medium capitalize truncate font-mono">
                {displayRole}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-w-0 min-h-screen">
        {/* Modern Theme-Aware Topbar */}
        <header className="sticky top-0 z-30 h-16 bg-[var(--color-surface)]/90 backdrop-blur-md border-b border-[var(--color-border)] px-4 lg:px-8 flex items-center justify-between gap-4 shadow-xs transition-colors">
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-teal-700 dark:text-teal-400 hover:bg-[var(--color-surface-hover)]"
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Global Search Bar */}
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-teal-600 dark:text-teal-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                id="global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient records, tokens, or bills (Ctrl+K)…"
                className="w-full pl-9 pr-14 py-2 text-xs bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-hover)] focus:bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-[var(--brand-primary)] transition-all font-medium"
              />
              <span className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none">
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded shadow-2xs font-semibold">
                  Ctrl K
                </kbd>
              </span>
            </form>
          </div>

          {/* Right Area: Date, Theme Toggle, Notifications, User */}
          <div className="flex items-center gap-2.5 relative">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-raised)] rounded-xl text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)]">
              <svg className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{todayFormatted}</span>
            </div>

            {/* Theme Toggle (Light / Dark / Mobile OS Auto) */}
            <ThemeToggle variant="compact" />

            {/* Notification Bell with interactive popover */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                title="Notifications"
                className="relative p-2 rounded-xl text-teal-700 dark:text-teal-400 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] border border-[var(--color-border)] transition-colors"
                aria-expanded={showNotifications}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-[var(--color-surface)]"></span>
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-[var(--color-surface)] rounded-2xl shadow-xl border border-[var(--color-border)] p-3 z-50 text-xs animate-fadein">
                  <div className="flex items-center justify-between font-bold text-[var(--color-text)] pb-2 border-b border-[var(--color-border)] mb-2">
                    <span>Notifications</span>
                    <span className="badge badge-success text-[10px]">All caught up</span>
                  </div>
                  <div className="py-2 text-[var(--color-text-secondary)] text-center font-medium">
                    No unread clinical alerts or appointment requests.
                  </div>
                </div>
              )}
            </div>

            {/* Quick Profile Chip */}
            <div className="flex items-center gap-2 pl-2 border-l border-[var(--color-border)]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-600 to-emerald-700 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
            </div>
          </div>
        </header>

        {/* Page Main Content with Mobile Bottom Padding */}
        <main className="flex-1 p-3.5 sm:p-4 lg:p-8 max-w-7xl w-full mx-auto pb-24 lg:pb-8">
          <Outlet />
        </main>

        {/* ── Dedicated Mobile Bottom Navigation Bar ── */}
        <nav
          aria-label="Mobile Navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] px-1 py-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-lg transition-colors"
        >
          <NavLink
            to="/dashboard"
            end
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] tracking-tight transition-all min-w-[54px] min-h-[44px] ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-extrabold bg-teal-50/90 dark:bg-teal-950/60 scale-105'
                  : 'text-slate-800 dark:text-slate-200 font-bold hover:text-teal-600'
              }`
            }
          >
            <HomeIcon className="w-5 h-5 mb-0.5 text-teal-700 dark:text-teal-400" />
            <span>Home</span>
          </NavLink>

          <NavLink
            to="/dashboard/patients"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] tracking-tight transition-all min-w-[54px] min-h-[44px] ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-extrabold bg-teal-50/90 dark:bg-teal-950/60 scale-105'
                  : 'text-slate-800 dark:text-slate-200 font-bold hover:text-teal-600'
              }`
            }
          >
            <UsersIcon className="w-5 h-5 mb-0.5 text-teal-700 dark:text-teal-400" />
            <span>Patients</span>
          </NavLink>

          <NavLink
            to="/dashboard/appointments"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] tracking-tight transition-all min-w-[54px] min-h-[44px] ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-extrabold bg-teal-50/90 dark:bg-teal-950/60 scale-105'
                  : 'text-slate-800 dark:text-slate-200 font-bold hover:text-teal-600'
              }`
            }
          >
            <CalendarIcon className="w-5 h-5 mb-0.5 text-teal-700 dark:text-teal-400" />
            <span>Appts</span>
          </NavLink>

          <NavLink
            to="/dashboard/queue"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] tracking-tight transition-all min-w-[54px] min-h-[44px] ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400 font-extrabold bg-teal-50/90 dark:bg-teal-950/60 scale-105'
                  : 'text-slate-800 dark:text-slate-200 font-bold hover:text-teal-600'
              }`
            }
          >
            <QueueIcon className="w-5 h-5 mb-0.5 text-teal-700 dark:text-teal-400" />
            <span>Queue</span>
          </NavLink>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-[10px] tracking-tight text-slate-800 dark:text-slate-200 font-bold hover:text-teal-600 transition-all min-w-[54px] min-h-[44px]"
            aria-label="Open full workspace menu"
          >
            <MenuIcon className="w-5 h-5 mb-0.5 text-teal-700 dark:text-teal-400" />
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

function MenuIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  )
}

function HomeIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function CalendarIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function UsersIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function QueueIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  )
}

function FileTextIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}

function CreditCardIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

function ShoppingBagIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}

function PillIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  )
}

function ShieldCheckIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}

function BoxIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  )
}

function BarChartIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )
}

function MailIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function SettingsIcon(props: { className?: string }) {
  return (
    <svg className={props.className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}