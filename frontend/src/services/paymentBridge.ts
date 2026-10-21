import api from './api'

/**
 * B2.9 payment bridge. On the Android shell the native listener/receiver queue bank
 * SMS and soundbox notifications locally; nothing native ever holds a credential or
 * talks to the network. This drains that queue while a live session exists and posts
 * each signal to the authenticated bridge endpoint, which resolves the tenant from
 * the token and matches the amount against an open invoice.
 *
 * Once a phone is paired, each body is signed by the native plugin. The secret lives
 * in the Android Keystore, never in this layer, so a stolen clinic login cannot
 * manufacture a receipt from a browser.
 *
 * Queue lifetime: the server dedupes on (source, eventId), so a signal uploaded twice
 * is a no-op; the queue is cleared only after every signal was accepted.
 */
export interface PaymentSignal {
  eventId: string
  amount: number
  utr?: string
  reference?: string
  source?: string
  rawText?: string
}

export interface BridgeStatus {
  smsGranted: boolean
  notificationListenerGranted: boolean
  queueCount: number
  paired?: boolean
  deviceId?: string | null
}

export interface BridgeDevice {
  id: string
  name: string
  paired: boolean
  pairedAt?: string | null
  lastSeenAt?: string | null
  revoked: boolean
}

interface DeviceSignature {
  deviceId: string
  timestampMs: number
  signature: string
}

interface PaymentBridgePlugin {
  peek(): Promise<{ signals?: PaymentSignal[] }>
  clear(): Promise<void>
  getStatus(): Promise<BridgeStatus>
  requestSms(): Promise<{ granted: boolean }>
  openNotificationSettings(): Promise<void>
  saveCredentials(credentials: { deviceId: string; secret: string }): Promise<void>
  clearCredentials(): Promise<void>
  signBody(payload: { body: string }): Promise<DeviceSignature>
}

function plugin(): PaymentBridgePlugin | null {
  const capacitor = (window as any).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.PaymentBridge ?? null
}

export function isPaymentBridgeAvailable(): boolean {
  return plugin() !== null
}

export async function getBridgeStatus(): Promise<BridgeStatus | null> {
  const bridge = plugin()
  if (!bridge) return null
  try {
    return await bridge.getStatus()
  } catch {
    return null
  }
}

export async function requestBridgeSmsPermission(): Promise<boolean> {
  const bridge = plugin()
  if (!bridge) return false
  try {
    const res = await bridge.requestSms()
    return Boolean(res?.granted)
  } catch {
    return false
  }
}

export async function openBridgeNotificationSettings(): Promise<void> {
  const bridge = plugin()
  if (!bridge) return
  await bridge.openNotificationSettings()
}

/** Pairs this handset: the secret is handed to the plugin and dropped here immediately. */
export async function pairThisPhone(pairingCode: string, name?: string): Promise<BridgeDevice> {
  const bridge = plugin()
  if (!bridge) throw new Error('This device has no payment bridge.')

  const { data } = await api.post<{ deviceId: string; name: string; secret: string }>(
    'integrations/payments/bridge/devices/pair',
    { pairingCode, name },
  )

  await bridge.saveCredentials({ deviceId: data.deviceId, secret: data.secret })
  return { id: data.deviceId, name: data.name, paired: true, revoked: false }
}

export async function unpairThisPhone(): Promise<void> {
  await plugin()?.clearCredentials()
}

export async function createBridgePairingCode(name: string): Promise<{ pairingCode: string; expiresAt: string }> {
  const { data } = await api.post('integrations/payments/bridge/devices/pairing-code', { name })
  return { pairingCode: data.pairingCode, expiresAt: data.expiresAt }
}

export async function listBridgeDevices(): Promise<BridgeDevice[]> {
  const { data } = await api.get<{ devices: BridgeDevice[] }>('integrations/payments/bridge/devices')
  return data.devices ?? []
}

export async function revokeBridgeDevice(id: string): Promise<void> {
  await api.post(`integrations/payments/bridge/devices/${id}/revoke`)
}

/** Uploads everything queued on the device. Resolves once the queue is empty or unsendable. */
export async function drainPaymentBridge(): Promise<number> {
  const bridge = plugin()
  if (!bridge) return 0

  const { signals } = await bridge.peek()
  if (!signals?.length) return 0

  let uploaded = 0
  let failed = false
  for (const signal of signals) {
    // Sign the exact bytes we send: the server hashes the raw body, so this string
    // must go out verbatim (axios sends a string body unchanged).
    const body = JSON.stringify(signal)
    try {
      const headers: Record<string, string> = {}
      const signature = await bridge.signBody({ body }).catch(() => null)
      if (signature) {
        headers['X-Device-Id'] = signature.deviceId
        headers['X-Device-Timestamp'] = String(signature.timestampMs)
        headers['X-Device-Signature'] = signature.signature
      }

      await api.post('integrations/payments/bridge/notifications', body, {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
      uploaded++
    } catch (error: any) {
      // A device revoked from another admin's phone would otherwise sign forever and
      // never drain: drop the local secret so the next attempt falls back to the JWT.
      if (error?.response?.data?.error === 'unknown_device') {
        await bridge.clearCredentials()
      }
      // Left queued for the next drain; a repeat upload is a server-side no-op.
      failed = true
    }
  }

  if (!failed) await bridge.clear()
  return uploaded
}
