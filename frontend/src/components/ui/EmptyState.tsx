// EmptyState — designed placeholder for empty lists/tables
interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="empty-state-title">{title}</p>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  )
}

// Pre-built empties for common pages
export function EmptyPatients({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={<PatientIcon />}
      title="No patients yet"
      description="Register your first patient to get started."
      action={
        onAdd && (
          <button className="btn btn-primary btn-sm" onClick={onAdd}>
            Register patient
          </button>
        )
      }
    />
  )
}

export function EmptyAppointments({ onBook }: { onBook?: () => void }) {
  return (
    <EmptyState
      icon={<CalendarIcon />}
      title="No appointments"
      description="No appointments scheduled for this period."
      action={
        onBook && (
          <button className="btn btn-primary btn-sm" onClick={onBook}>
            Book appointment
          </button>
        )
      }
    />
  )
}

export function EmptySearch() {
  return (
    <EmptyState
      icon={<SearchIcon />}
      title="No results found"
      description="Try a different search term or clear the filter."
    />
  )
}

function PatientIcon() {
  return (
    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg className="empty-state-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.25}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  )
}
