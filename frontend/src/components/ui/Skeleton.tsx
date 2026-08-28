// Skeleton — shimmer loading placeholder
interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string
  className?: string
  count?: number
  gap?: number
}

export function Skeleton({ width = '100%', height = 16, radius = '6px', className = '' }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: radius,
        flexShrink: 0,
      }}
      aria-hidden="true"
    />
  )
}

export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={14} />
      ))}
    </div>
  )
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <Skeleton height={14} width={i === 0 ? 120 : 80} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-5 space-y-3 ${className}`} aria-hidden="true">
      <Skeleton height={12} width={80} />
      <Skeleton height={32} width={120} />
      <Skeleton height={12} width={100} />
    </div>
  )
}
