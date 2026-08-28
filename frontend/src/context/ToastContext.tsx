import { createContext, useContext, useState, useCallback } from 'react'

// ── Toast types ───────────────────────────────────────────────────────────────
type ToastVariant = 'default' | 'success' | 'error' | 'warning'
interface ToastItem { id: string; message: string; variant: ToastVariant }

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

// ── Provider ──────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, variant: ToastVariant = 'default') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite" aria-atomic="false">
          {toasts.map(t => (
            <div key={t.id} className={`toast ${t.variant !== 'default' ? `toast-${t.variant}` : ''}`}>
              {t.variant === 'success' && (
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {t.variant === 'error' && (
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useToast() {
  return useContext(ToastContext)
}
