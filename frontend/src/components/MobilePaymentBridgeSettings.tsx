import { useState, useEffect, useCallback } from 'react'
import {
  isPaymentBridgeAvailable,
  getBridgeStatus,
  requestBridgeSmsPermission,
  openBridgeNotificationSettings,
  drainPaymentBridge,
  createBridgePairingCode,
  pairThisPhone,
  unpairThisPhone,
  listBridgeDevices,
  revokeBridgeDevice,
  type BridgeStatus,
  type BridgeDevice,
} from '../services/paymentBridge'
import { getCustomApiBaseUrl, setCustomApiBaseUrl } from '../services/api'
import { useToast } from '../context/ToastContext'

export default function MobilePaymentBridgeSettings({ isAdmin = false }: { isAdmin?: boolean }) {
  const { toast } = useToast()
  const isAvailable = isPaymentBridgeAvailable()
  const [status, setStatus] = useState<BridgeStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [flushing, setFlushing] = useState(false)
  const [serverUrl, setServerUrl] = useState(() => getCustomApiBaseUrl())
  const [editingUrl, setEditingUrl] = useState(false)
  const [codeInput, setCodeInput] = useState('')
  const [pairingCode, setPairingCode] = useState('')
  const [pairing, setPairing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [devices, setDevices] = useState<BridgeDevice[]>([])

  const refreshStatus = useCallback(async () => {
    if (!isAvailable) return
    setLoading(true)
    try {
      const st = await getBridgeStatus()
      setStatus(st)
    } finally {
      setLoading(false)
    }
  }, [isAvailable])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  if (!isAvailable) {
    return null
  }

  const handleRequestSms = async () => {
    const granted = await requestBridgeSmsPermission()
    if (granted) {
      toast('SMS permission granted.', 'success')
    } else {
      toast('SMS permission was denied or not granted.', 'error')
    }
    await refreshStatus()
  }

  const handleOpenNotificationSettings = async () => {
    try {
      await openBridgeNotificationSettings()
      toast('Returned from settings? Please refresh to check listener access.')
    } catch {
      toast('This device has no notification access screen.', 'error')
    }
  }

  const handleFlushQueue = async () => {
    setFlushing(true)
    try {
      const count = await drainPaymentBridge()
      toast(`Synchronized ${count} signal(s) from device queue.`, 'success')
      await refreshStatus()
    } catch {
      toast('Failed to flush payment signals to backend.', 'error')
    } finally {
      setFlushing(false)
    }
  }

  const refreshDevices = useCallback(async () => {
    if (!isAdmin) return
    try {
      setDevices(await listBridgeDevices())
    } catch {
      // 403 simply means this user cannot see the tenant's devices.
    }
  }, [isAdmin])

  useEffect(() => {
    void refreshDevices()
  }, [refreshDevices])

  const handleGenerateCode = async () => {
    setGenerating(true)
    try {
      const { pairingCode: code } = await createBridgePairingCode('Clinic phone')
      setPairingCode(code)
      toast('Pairing code generated; it expires in 10 minutes.', 'success')
      await refreshDevices()
    } catch {
      toast('Could not generate a pairing code.', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const handlePair = async () => {
    setPairing(true)
    try {
      await pairThisPhone(codeInput.trim())
      setCodeInput('')
      setPairingCode('')
      toast('This phone is paired; signals are now signed.', 'success')
      await refreshStatus()
      await refreshDevices()
    } catch {
      toast('Pairing failed. Check the code and try again.', 'error')
    } finally {
      setPairing(false)
    }
  }

  const handleUnpair = async () => {
    await unpairThisPhone()
    toast('This phone no longer signs signals.', 'success')
    await refreshStatus()
  }

  const handleRevoke = async (id: string) => {
    try {
      await revokeBridgeDevice(id)
      toast('Device revoked.', 'success')
      await refreshDevices()
    } catch {
      toast('Could not revoke that device.', 'error')
    }
  }

  const handleSaveServerUrl = () => {
    setCustomApiBaseUrl(serverUrl)
    toast('Server API Base URL updated. Reloading...', 'success')
    setTimeout(() => {
      window.location.reload()
    }, 500)
  }

  return (
    <div className="card mb-6 border border-teal-500/30 bg-gradient-to-br from-[var(--color-surface)] to-teal-950/10 p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-lg font-bold text-[var(--color-text)]">
              Android Native Hardware Bridge
            </h3>
            <span className="badge badge-info text-xs">Capacitor 6</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Enables local soundbox notification capture and bank SMS verification directly into billing.
          </p>
        </div>

        <button
          type="button"
          onClick={refreshStatus}
          disabled={loading}
          className="btn btn-secondary text-xs self-start sm:self-auto"
        >
          {loading ? 'Checking…' : 'Refresh Status'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {/* SMS Status */}
        <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Bank SMS Receiver
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status?.smsGranted ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm font-bold">
              {status?.smsGranted ? 'Permission Granted' : 'Permission Required'}
            </span>
          </div>
          {!status?.smsGranted && (
            <button
              type="button"
              onClick={handleRequestSms}
              className="btn btn-primary text-xs w-full justify-center"
            >
              Grant SMS Permission
            </button>
          )}
        </div>

        {/* Notification Listener Status */}
        <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Soundbox Listener
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                status?.notificationListenerGranted ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm font-bold">
              {status?.notificationListenerGranted ? 'Active & Listening' : 'Access Disabled'}
            </span>
          </div>
          {!status?.notificationListenerGranted && (
            <button
              type="button"
              onClick={handleOpenNotificationSettings}
              className="btn btn-secondary text-xs w-full justify-center"
            >
              Configure in Settings
            </button>
          )}
        </div>

        {/* Queue Count */}
        <div className="rounded-lg border border-[var(--color-border)] p-4 bg-[var(--color-surface)]">
          <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Queued Signals
          </div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl font-extrabold text-[var(--color-accent)]">
              {status?.queueCount ?? 0}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">pending sync</span>
          </div>
          <button
            type="button"
            onClick={handleFlushQueue}
            disabled={flushing || !status?.queueCount}
            className="btn btn-secondary text-xs w-full justify-center"
          >
            {flushing ? 'Syncing…' : 'Sync Queue Now'}
          </button>
        </div>
      </div>

      {/* Device signing (B2.9): pairing is what switches the HMAC requirement on */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">Device Signing</div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {status?.paired
                ? `This phone signs every signal (device ${status.deviceId?.slice(0, 8)}…).`
                : 'Not paired. Signals post with the clinic login only.'}
            </div>
          </div>
          {status?.paired && (
            <button
              type="button"
              onClick={handleUnpair}
              className="btn btn-secondary text-xs self-start sm:self-auto"
            >
              Unpair this phone
            </button>
          )}
        </div>

        {!status?.paired && (
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codeInput}
              onChange={e => setCodeInput(e.target.value)}
              placeholder="6-digit pairing code"
              className="form-input text-xs font-mono flex-1"
            />
            <button
              type="button"
              onClick={handlePair}
              disabled={pairing || codeInput.trim().length !== 6}
              className="btn btn-primary text-xs"
            >
              {pairing ? 'Pairing…' : 'Pair this phone'}
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={handleGenerateCode}
                disabled={generating}
                className="btn btn-secondary text-xs"
              >
                {generating ? 'Generating…' : 'Generate a code'}
              </button>
            )}
          </div>
        )}

        {pairingCode && (
          <div className="alert alert-info mt-3 text-xs" role="status">
            Pairing code{' '}
            <span className="font-mono text-base font-bold tracking-widest">{pairingCode}</span>{' '}
            — valid for 10 minutes.
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="pt-4 mt-4 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-[var(--color-text)]">Paired devices</div>
            <button
              type="button"
              onClick={refreshDevices}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
            >
              Refresh
            </button>
          </div>
          {devices.length === 0 ? (
            <div className="text-xs text-[var(--color-text-muted)]">No devices paired yet.</div>
          ) : (
            <ul className="space-y-2">
              {devices.map(device => (
                <li key={device.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[var(--color-text)]">
                    <span className="font-semibold">{device.name}</span>{' '}
                    <span
                      className={
                        device.revoked
                          ? 'text-red-500'
                          : device.paired
                            ? 'text-emerald-600'
                            : 'text-amber-600'
                      }
                    >
                      {device.revoked ? 'revoked' : device.paired ? 'paired' : 'unpaired'}
                    </span>
                  </span>
                  {!device.revoked && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(device.id)}
                      className="text-red-500 hover:underline font-semibold"
                    >
                      Revoke
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Backend Server URL override for physical devices */}
      <div className="pt-4 border-t border-[var(--color-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div>
            <div className="text-sm font-semibold text-[var(--color-text)]">
              Clinic Server Connection (API Base URL)
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Default is <code>10.0.2.2:5000</code> on emulator. For physical Android tablets, enter the clinic workstation IP (e.g., <code>http://192.168.1.100:5000/api/v1</code>).
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEditingUrl(v => !v)}
            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline self-start sm:self-auto"
          >
            {editingUrl ? 'Cancel' : 'Change Address'}
          </button>
        </div>

        {editingUrl && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              value={serverUrl}
              onChange={e => setServerUrl(e.target.value)}
              placeholder="http://192.168.1.100:5000/api/v1"
              className="form-input text-xs font-mono flex-1"
            />
            <button
              type="button"
              onClick={handleSaveServerUrl}
              className="btn btn-primary text-xs"
            >
              Save & Apply
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
