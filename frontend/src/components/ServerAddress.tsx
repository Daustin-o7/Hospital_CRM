import { useState } from 'react'
import { getCustomApiBaseUrl, setCustomApiBaseUrl } from '../services/api'

/**
 * C1: the Android build defaults to the emulator alias (10.0.2.2), which a real tablet
 * cannot reach. Settings sits behind the login wall, so a fresh install on a clinic
 * phone could never sign in. The override is therefore also offered here.
 * The axios instance reads the base URL at module load, hence the reload.
 */
export default function ServerAddress() {
  const isNative = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState(() => getCustomApiBaseUrl())

  if (!isNative) return null

  const save = () => {
    setCustomApiBaseUrl(url)
    window.location.reload()
  }

  return (
    <div style={{ marginTop: 14, textAlign: 'center' }}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-[var(--color-text-muted)] hover:underline"
        >
          {getCustomApiBaseUrl() ? `Server: ${getCustomApiBaseUrl()}` : 'Server: emulator default (10.0.2.2) — change'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://192.168.1.100:5000/api/v1"
            className="form-input text-xs font-mono flex-1"
            aria-label="Clinic server address"
          />
          <button type="button" onClick={save} className="btn btn-primary text-xs">
            Save
          </button>
        </div>
      )}
    </div>
  )
}
