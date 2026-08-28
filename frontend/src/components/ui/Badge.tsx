// Badge — appointment and status indicators
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  dot?: boolean
  className?: string
}

export function Badge({ variant = 'neutral', children, dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`badge badge-${variant} ${className}`}>
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}

// Appointment status → badge variant
const APPT_STATUS: Record<string, BadgeVariant> = {
  scheduled:  'info',
  confirmed:  'brand',
  checkedin:  'warning',
  'checked-in': 'warning',
  inprogress: 'warning',
  completed:  'success',
  cancelled:  'danger',
  noshow:     'neutral',
  'no-show':  'neutral',
}

export function AppointmentBadge({ status }: { status: string }) {
  const key = status?.toLowerCase().replace(/\s/g, '')
  const variant = APPT_STATUS[key] ?? 'neutral'
  const label = status?.charAt(0).toUpperCase() + status?.slice(1) || '—'
  return <Badge variant={variant}>{label}</Badge>
}

// Invoice payment status → badge
const INVOICE_STATUS: Record<string, BadgeVariant> = {
  paid:     'success',
  pending:  'warning',
  overdue:  'danger',
  waived:   'neutral',
  partial:  'info',
}

export function InvoiceBadge({ status }: { status: string }) {
  const key = status?.toLowerCase()
  const variant = INVOICE_STATUS[key] ?? 'neutral'
  const label = status?.charAt(0).toUpperCase() + status?.slice(1) || '—'
  return <Badge variant={variant}>{label}</Badge>
}

// Role badge
const ROLE_DISPLAY: Record<string, string> = {
  clinicadmin:  'Admin',
  doctor:       'Doctor',
  receptionist: 'Reception',
}
export function RoleBadge({ role }: { role: string }) {
  const label = ROLE_DISPLAY[role?.toLowerCase()] ?? role
  return <Badge variant="brand">{label}</Badge>
}
