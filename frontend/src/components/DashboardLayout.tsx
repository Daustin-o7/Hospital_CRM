import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useBranding } from '../context/BrandingContext'

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
    name: 'Patients',
    href: '/dashboard/patients',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: UsersIcon,
  },
  {
    name: 'Appointments',
    href: '/dashboard/appointments',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: CalendarIcon,
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
    name: 'Staff',
    href: '/dashboard/staff',
    roles: ['clinicadmin'],
    icon: UserPlusIcon,
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    roles: ['clinicadmin', 'doctor', 'receptionist'],
    icon: SettingsIcon,
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────────
const ROLE_LABEL: Record<string, string> = {
  clinicadmin:  'Clinic Admin',
  doctor:       'Doctor',
  receptionist: 'Receptionist',
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user')
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: 'User', role: 'doctor', email: '' }
}

function getPageTitle(pathname: string): string {
  if (pathname === '/dashboard') return 'Dashboard'
  if (pathname.includes('/patients')) return 'Patients'
  if (pathname.includes('/appointments')) return 'Appointments'
  if (pathname.includes('/queue')) return 'Queue'
  if (pathname.includes('/consultations')) return 'Consultations'
  if (pathname.includes('/billing')) return 'Billing'
  if (pathname.includes('/staff')) return 'Staff'
  if (pathname.includes('/settings')) return 'Settings'
  return 'Dashboard'
}

// ── Main Layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { branding } = useBranding()

  const user = getStoredUser()
  const rawRole = String(user?.role || 'doctor').toLowerCase()
  const displayRole = ROLE_LABEL[rawRole] ?? 'User'
  const filteredNav = NAV_ITEMS.filter(item => item.roles.includes(rawRole))

  const handleLogout = () => {
    localStorage.clear()
    navigate('/login')
  }

  // Close mobile sidebar on route change
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', display: 'flex' }}>
      {/* ── Mobile sidebar overlay ── */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 150,
            background: 'rgba(15,23,42,0.4)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile sidebar panel ── */}
      <aside
        aria-label="Navigation"
        style={{
          position: 'fixed',
          top: 0, bottom: 0, left: 0,
          zIndex: 160,
          width: 'var(--sidebar-width)',
          background: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
          display: 'flex',
          flexDirection: 'column',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 250ms var(--ease)',
          willChange: 'transform',
        }}
        className="hide-tablet"
      >
        <SidebarContent
          nav={filteredNav}
          user={user}
          displayRole={displayRole}
          branding={branding}
          onClose={() => setSidebarOpen(false)}
        />
      </aside>

      {/* ── Desktop sidebar ── */}
      <aside
        aria-label="Navigation"
        style={{
          position: 'fixed',
          top: 0, bottom: 0, left: 0,
          zIndex: 40,
          width: 'var(--sidebar-width)',
          background: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="show-mobile-only"
        // Note: "show-mobile-only" is actually for hiding on small screens
        // We use a CSS media query approach — see below
      />

      {/* Real desktop sidebar — always visible on lg+ */}
      <aside
        aria-label="Navigation"
        style={{
          position: 'fixed',
          top: 0, bottom: 0, left: 0,
          zIndex: 40,
          width: 'var(--sidebar-width)',
          background: 'var(--color-sidebar)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <SidebarContent
          nav={filteredNav}
          user={user}
          displayRole={displayRole}
          branding={branding}
        />
      </aside>

      {/* ── Main content ── */}
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: '100dvh',
        }}
      >
        {/* ── Topbar ── */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 30,
            height: 'var(--topbar-height)',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 16,
          }}
        >
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation menu"
            className="btn btn-ghost btn-sm"
            style={{ padding: 8, marginLeft: -8 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Page title */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.025em',
                lineHeight: 1,
              }}
            >
              {getPageTitle(location.pathname)}
            </h1>
          </div>

          {/* Right zone */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* User info */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 12px 6px 8px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              <div className="avatar avatar-sm">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  {displayRole}
                </div>
              </div>
            </div>

            {/* Sign out */}
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="btn btn-ghost btn-sm"
              title="Sign out"
              style={{ padding: 8, color: 'var(--color-text-muted)' }}
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main
          style={{
            flex: 1,
            padding: '28px var(--page-padding)',
            maxWidth: 'calc(var(--content-max) + 2 * var(--page-padding))',
            width: '100%',
            margin: '0 auto',
            boxSizing: 'border-box',
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Sidebar Content ───────────────────────────────────────────────────────────
interface SidebarContentProps {
  nav: typeof NAV_ITEMS
  user: any
  displayRole: string
  branding: any
  onClose?: () => void
}

function SidebarContent({ nav, user, displayRole, branding, onClose }: SidebarContentProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Clinic brand header ── */}
      <div
        style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo / icon */}
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.organizationName}
              style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', objectFit: 'cover', flexShrink: 0 }}
              loading="lazy"
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px var(--brand-primary-20)',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 14H11v-4H7v-2h4V6h2v4h4v2h-4v4z"/>
              </svg>
            </div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {branding.organizationName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--brand-primary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginTop: 1,
              }}
            >
              {branding.organizationType ?? 'Healthcare'}
            </div>
          </div>
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="btn btn-ghost btn-sm"
              style={{ padding: 6, flexShrink: 0 }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav
        aria-label="Main navigation"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {nav.map(item => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── User footer ── */}
      <div
        style={{
          padding: '12px 10px 16px',
          borderTop: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {/* User card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="avatar avatar-sm">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>
              {displayRole}
            </div>
          </div>
        </div>

        {/* Powered by */}
        <div
          style={{
            marginTop: 12,
            textAlign: 'center',
            fontSize: 10.5,
            color: 'var(--color-text-muted)',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          Powered by{' '}
          <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>SAMSTACK AI</span>
        </div>
      </div>
    </div>
  )
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function HomeIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function UsersIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}
function CalendarIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}
function QueueIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 6h16M4 10h16M4 14h8m-8 4h4" />
    </svg>
  )
}
function FileTextIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function CreditCardIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}
function UserPlusIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  )
}
function SettingsIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}