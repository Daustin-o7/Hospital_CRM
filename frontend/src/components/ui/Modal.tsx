import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Prevent close when clicking overlay */
  persistent?: boolean
}

const SIZE_MAP = { sm: 400, md: 520, lg: 680 }

export function Modal({ open, onClose, title, description, children, footer, size = 'md', persistent = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Focus trap + Escape
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement
    const panel = panelRef.current
    if (panel) {
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable[0]?.focus()
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose()
      if (e.key === 'Tab' && panel) {
        const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        ))
        if (focusable.length === 0) { e.preventDefault(); return }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault()
          ;(e.shiftKey ? last : first).focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    // Prevent body scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus()
    }
  }, [open, onClose, persistent])

  if (!open) return null

  return createPortal(
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
      onClick={(e) => { if (e.target === e.currentTarget && !persistent) onClose() }}
    >
      <div
        ref={panelRef}
        className="modal-panel"
        style={{ maxWidth: SIZE_MAP[size] }}
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.025em' }}>
              {title}
            </h2>
            {description && (
              <p id="modal-desc" style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="btn btn-ghost btn-sm"
            style={{ padding: 6 }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="modal-body">{children}</div>

        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────
interface ConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  loading?: boolean
}

export function Confirm({
  open, onClose, onConfirm, title, description,
  confirmLabel = 'Confirm', variant = 'primary', loading = false
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={`btn btn-${variant === 'danger' ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <span className="spinner spinner-sm" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      {/* Content passed as description; modal body empty */}
      <div />
    </Modal>
  )
}
