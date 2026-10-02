import type { ReactNode, CSSProperties } from 'react'

export interface EmptyStateActionObj {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'ghost'
}

export interface EmptyStateProps {
  illustration?: ReactNode
  icon?: ReactNode
  title: string
  description?: string
  action?: EmptyStateActionObj | ReactNode
  className?: string
}

const EMPTY_ILLUSTRATIONS = {
  consultations: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 4" opacity="0.3"/>
      <path d="M24 40 L40 24 L56 40 L40 56 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
      <circle cx="40" cy="40" r="4" fill="currentColor" opacity="0.6"/>
    </svg>
  ),
  patients: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="28" r="14" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
      <path d="M12 70 C12 50 28 38 40 38 C52 38 68 50 68 70" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.5"/>
      <circle cx="40" cy="40" r="6" fill="currentColor" opacity="0.4"/>
    </svg>
  ),
  prescriptions: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="22" width="44" height="48" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4"/>
      <path d="M30 32 L50 32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <path d="M30 42 L46 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <path d="M30 52 L42 52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <circle cx="60" cy="30" r="6" fill="currentColor" opacity="0.4"/>
      <path d="M60 26 L60 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M56 30 L64 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  invoices: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="18" y="18" width="44" height="52" rx="4" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.4"/>
      <path d="M28 30 L52 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <path d="M28 40 L48 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <path d="M28 50 L44 50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      <circle cx="60" cy="30" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4"/>
      <path d="M60 26 L60 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M56 30 L64 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  default: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.3"/>
      <circle cx="40" cy="40" r="8" fill="currentColor" opacity="0.3"/>
    </svg>
  ),
}

export function EmptyState({
  illustration,
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  const Illustr = illustration || icon || EMPTY_ILLUSTRATIONS.default

  const isActionObject = (act: any): act is EmptyStateActionObj => {
    return act && typeof act === 'object' && 'label' in act && 'onClick' in act
  }

  return (
    <div
      className={`empty-state ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        textAlign: 'center',
        minHeight: '280px',
      }}
    >
      <div
        style={{
          color: 'var(--color-text-muted)',
          opacity: 0.6,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {Illustr}
      </div>
      <h3 style={{
        margin: '0 0 8px',
        fontSize: '18px',
        fontWeight: 600,
        color: 'var(--color-text)',
        fontFamily: 'var(--font-heading)',
      }}>
        {title}
      </h3>
      {description && (
        <p style={{
          margin: '0 0 24px',
          fontSize: '14px',
          color: 'var(--color-text-muted)',
          maxWidth: '360px',
          lineHeight: 1.5,
        }}>
          {description}
        </p>
      )}
      {action && (
        isActionObject(action) ? (
          <button
            onClick={action.onClick}
            className={`btn btn-${action.variant || 'primary'}`}
            style={{
              padding: '10px 20px',
              fontSize: '13.5px',
              fontWeight: 500,
            }}
          >
            {action.label}
          </button>
        ) : (
          <div>{action}</div>
        )
      )}
    </div>
  )
}

export function EmptyAppointments({ onBook }: { onBook?: () => void }) {
  return (
    <EmptyState
      illustration={EMPTY_ILLUSTRATIONS.consultations}
      title="No Appointments Scheduled"
      description="There are no appointments scheduled for this view. You can create a new appointment for a patient."
      action={onBook ? {
        label: 'Book Appointment',
        onClick: onBook,
        variant: 'primary',
      } : undefined}
    />
  )
}

export function EmptySearch() {
  return (
    <EmptyState
      title="No results found"
      description="Try searching with a different patient name, phone number, or UHID."
    />
  )
}

export function Skeleton({
  className = '',
  width = '100%',
  height = '16px',
  borderRadius = 'var(--radius-md)',
  style,
}: {
  className?: string
  width?: string
  height?: string
  borderRadius?: string
  style?: CSSProperties
}) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, var(--color-surface-raised) 25%, var(--color-border) 50%, var(--color-surface-raised) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card ${className}`} style={{ padding: '20px', minHeight: '140px' }}>
      <Skeleton width="40%" height="20px" style={{ marginBottom: '16px' }} />
      <Skeleton width="60%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="80%" height="14px" style={{ marginBottom: '8px' }} />
      <Skeleton width="50%" height="14px" />
    </div>
  )
}

export function SkeletonTableRow({ columns = 5 }: { columns?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '16px', padding: '12px 0' }}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height="16px" width="80%" />
      ))}
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}