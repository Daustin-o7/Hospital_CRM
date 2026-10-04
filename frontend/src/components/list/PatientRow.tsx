import { memo, useCallback } from 'react';
import { Badge } from '../ui/Badge';

const Avatar = ({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' | 'lg' }) => {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()
  
  const sizeClasses = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  }
  
  return (
    <div
      className={`flex items-center justify-center rounded-full flex-shrink-0 ${sizeClasses[size]}`}
      style={{
        background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
        color: '#fff',
        fontWeight: 700,
      }}
    >
      {initials}
    </div>
  )
}

interface Patient {
  id: string
  name: string
  phone: string
  dob?: string
  approxAge?: number
  gender: string
  address?: string
  createdAt: string
}

interface PatientRowProps {
  patient: Patient
  onView: (id: string) => void
  onEdit?: (patient: any) => void
  formatDate: (date: string | null | undefined) => string
}

export const PatientRow = memo(function PatientRow({
  patient,
  onView,
  onEdit,
  formatDate,
}: PatientRowProps) {
  const handleView = useCallback(() => {
    onView(patient.id)
  }, [onView, patient.id])

  const handleEdit = useCallback(() => {
    onEdit?.(patient)
  }, [onEdit, patient])

  return (
    <tr className="transition-colors hover:bg-[var(--color-surface-hover)]" onClick={handleView}>
      <td>
        <div className="flex items-center gap-2.5">
          <Avatar name={patient.name} size="sm" />
          <div>
            <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13.5px' }}>
              {patient.name}
            </span>
            <div className="text-xs text-[var(--color-text-muted)]">
              {patient.phone}
            </div>
          </div>
        </div>
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {patient.dob ? formatDate(patient.dob) : '—'}
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {patient.approxAge ? `${patient.approxAge} yrs` : '—'}
      </td>
      <td>
        <Badge variant="info">{patient.gender}</Badge>
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {patient.address ?? '—'}
      </td>
      <td className="text-[var(--color-text-muted)]">
        {formatDate(patient.createdAt)}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleEdit()
          }}
          className="btn btn-ghost btn-sm"
          aria-label={`Edit ${patient.name}`}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </td>
    </tr>
  )
})

PatientRow.displayName = 'PatientRow'