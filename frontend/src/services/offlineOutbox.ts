/**
 * FR-22 durable outbox. Holds invoices created while the API was unreachable so they
 * can be pushed once the network returns.
 *
 * The payload carries a patient name, so entries are dropped after a day and removed
 * on sign-out: a shared front-desk tablet must not keep yesterday's patients around.
 */
const KEY = 'hospital_crm_offline_outbox'
const MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface OutboxItem {
  id: string
  type: number
  idempotencyKey: string
  payloadJson: string
  createdAt: string
}

function writeOutbox(items: OutboxItem[]) {
  if (items.length === 0) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify(items))
}

function isStale(item: OutboxItem, now: number): boolean {
  const at = Date.parse(item.createdAt)
  return !Number.isFinite(at) || now - at > MAX_AGE_MS
}

/** Reads the queue and silently drops anything past its useful life. */
export function readOutbox(): OutboxItem[] {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(items)) return []

    const fresh = items.filter((item: OutboxItem) => !isStale(item, Date.now()))
    if (fresh.length !== items.length) writeOutbox(fresh)
    return fresh
  } catch {
    return []
  }
}

export function enqueueOutbox(item: OutboxItem) {
  writeOutbox([...readOutbox(), item])
}

export function outboxCount(): number {
  return readOutbox().length
}

export function clearOutbox() {
  localStorage.removeItem(KEY)
}
