/**
 * International Timezone & Midnight Boundary Helpers (Hospital CRM)
 */

export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export function getTimezoneOffsetMinutes(timezone?: string): number {
  try {
    const tz = timezone || detectUserTimezone()
    const now = new Date()
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
    const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }))
    return Math.round((tzDate.getTime() - utcDate.getTime()) / 60000)
  } catch {
    return 0
  }
}

export function getTimezoneLabel(timezone?: string): string {
  const tz = timezone || detectUserTimezone()
  const offsetMins = getTimezoneOffsetMinutes(tz)
  const sign = offsetMins >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMins)
  const hours = Math.floor(abs / 60)
  const mins = abs % 60
  const formattedOffset = `UTC${sign}${hours}${mins > 0 ? `:${mins.toString().padStart(2, '0')}` : ''}`
  return `${tz} (${formattedOffset})`
}

export function formatLocalDate(date: Date = new Date(), timezone?: string): string {
  const tz = timezone || detectUserTimezone()
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: tz
  })
}

export function formatLocalTime(date: Date = new Date(), timezone?: string): string {
  const tz = timezone || detectUserTimezone()
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz
  })
}

export function getTodayDateString(timezone?: string): string {
  const tz = timezone || detectUserTimezone()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const year = parts.find(p => p.type === 'year')?.value || '2026'
  const month = parts.find(p => p.type === 'month')?.value || '01'
  const day = parts.find(p => p.type === 'day')?.value || '01'
  return `${year}-${month}-${day}`
}
