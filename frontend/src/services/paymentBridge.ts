import api from './api'

/**
 * B2.9 payment bridge. On the Android shell the native listener/receiver queue bank
 * SMS and soundbox notifications locally; nothing native ever holds a credential or
 * talks to the network. This drains that queue while a live session exists and posts
 * each signal to the authenticated bridge endpoint, which resolves the tenant from
 * the token and matches the amount against an open invoice.
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

interface PaymentBridgePlugin {
  peek(): Promise<{ signals?: PaymentSignal[] }>
  clear(): Promise<void>
}

function plugin(): PaymentBridgePlugin | null {
  const capacitor = (window as any).Capacitor
  if (!capacitor?.isNativePlatform?.()) return null
  return capacitor.Plugins?.PaymentBridge ?? null
}

export function isPaymentBridgeAvailable(): boolean {
  return plugin() !== null
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
    try {
      await api.post('integrations/payments/bridge/notifications', signal)
      uploaded++
    } catch {
      // Left queued for the next drain; a repeat upload is a server-side no-op.
      failed = true
    }
  }

  if (!failed) await bridge.clear()
  return uploaded
}
