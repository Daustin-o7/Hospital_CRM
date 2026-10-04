import { memo } from 'react';
import { Badge } from '../ui/Badge';

export interface Drug {
  id: string
  name: string
  genericName: string
  strength: string
  dosageForm: string
  therapeuticCategory: string
  hsnCode: string
  gstRate: number
  nlemCovered: boolean
  dpcoCeilingPrice: number | null
  standardPackSize: string
  indicativeMrp: number
  commonBrands: string | null
  scheduleClass: string
  batches?: DrugBatch[]
}

export interface DrugBatch {
  id: string
  batchNumber: string
  expiryDate: string
  mfgDate?: string
  quantityReceived: number
  quantityRemaining: number
  mrp: number
  purchaseRate: number
  supplierName?: string
}

interface DrugRowProps {
  drug: Drug
  onView?: (id: string) => void
  onEdit?: (drug: any) => void
  today: Date
}

export const DrugRow = memo(function DrugRow({
  drug,
  onView,
  onEdit,
  today,
}: DrugRowProps) {
  const currentStock = drug.batches
    ?.filter(b => new Date(b.expiryDate) >= today)
    .reduce((sum, b) => sum + (b.quantityRemaining || 0), 0) ?? 0

  return (
    <tr className="transition-colors hover:bg-[var(--color-surface-hover)]">
      <td>
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold border border-teal-200 dark:border-teal-800 shrink-0">
            {drug.name.slice(0, 1).toUpperCase()}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--color-text)', fontSize: '13.5px' }}>
            {drug.name}
          </span>
        </div>
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {drug.genericName}
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {drug.strength}
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {drug.dosageForm}
      </td>
      <td>
        <Badge variant={drug.scheduleClass === 'ScheduleH1' ? 'danger' : drug.scheduleClass === 'ScheduleH' ? 'warning' : 'info'}>
          {drug.scheduleClass}
        </Badge>
      </td>
      <td className="text-[var(--color-text-secondary)]">
        {currentStock > 0 ? currentStock : 'Out of Stock'}
      </td>
      <td className="text-[var(--color-text-secondary)]">
        ₹{drug.indicativeMrp.toLocaleString('en-IN')}
      </td>
      <td>
        {drug.nlemCovered ? (
          <Badge variant="success">NLEM</Badge>
        ) : (
          <Badge variant="neutral">Non-NLEM</Badge>
        )}
      </td>
      <td style={{ textAlign: 'right' }}>
        <button
          onClick={() => onView?.(drug.id)}
          className="btn btn-ghost btn-sm mr-1"
          aria-label={`View ${drug.name}`}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
        <button
          onClick={() => onEdit?.(drug)}
          className="btn btn-ghost btn-sm"
          aria-label={`Edit ${drug.name}`}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      </td>
    </tr>
  )
})

DrugRow.displayName = 'DrugRow'