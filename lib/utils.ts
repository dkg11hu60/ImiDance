import { supabase } from './supabase'

export function getSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  if (longer.length === 0) return 1.0
  return (longer.length - editDistance(longer, shorter)) / longer.length
}

export function editDistance(s1: string, s2: string): number {
  s1 = s1.toLowerCase()
  s2 = s2.toLowerCase()
  const costs = new Array()
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else {
        if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
    }
    if (s1.length > 0) costs[s2.length] = lastValue
  }
  return costs[s2.length]
}

export async function logActivity(profileId: string, action: 'login' | 'logout' | 'attend' | 'cancel', eventId?: string) {
  try {
    await supabase.from('activity_logs').insert({
      profile_id: profileId,
      action: action,
      event_id: eventId || null
    })
  } catch (err) {
    console.error('Naplózási hiba:', err)
  }
}

/**
 * Normalizes date value to YYYY-MM-DD format.
 */
export function toDateKey(dateValue?: string | Date | null): string {
  if (!dateValue) return ''
  if (dateValue instanceof Date) {
    const y = dateValue.getFullYear()
    const m = String(dateValue.getMonth() + 1).padStart(2, '0')
    const day = String(dateValue.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const str = String(dateValue).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  if (str.includes('T')) return str.split('T')[0]
  const d = new Date(str)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return str.slice(0, 10)
}

/**
 * Calculates the exact registration deadline for an event:
 * 18:00 Budapest time on the day preceding the event date.
 * (Minden eseményre a megelőző nap 18:00 óráig lehet regisztrálni.)
 */
export function getRegistrationDeadline(eventDateValue: string | Date): Date {
  const dateKey = toDateKey(eventDateValue)
  if (!dateKey) return new Date(0)
  const parts = dateKey.split('-').map(Number)
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return new Date(0)
  }

  // Event day at 12:00:00 UTC
  const eventDateUtc = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0))
  // Subtract 1 day (24 hours) to get the preceding day
  const prevDateUtc = new Date(eventDateUtc.getTime() - 24 * 60 * 60 * 1000)
  const prevY = prevDateUtc.getUTCFullYear()
  const prevM = prevDateUtc.getUTCMonth()
  const prevD = prevDateUtc.getUTCDate()
  const prevDateKey = `${prevY}-${String(prevM + 1).padStart(2, '0')}-${String(prevD).padStart(2, '0')}`

  // Check Budapest timezone offset (UTC+1 in winter, UTC+2 in summer) on the preceding date
  const testDate = new Date(`${prevDateKey}T12:00:00Z`)
  const budapestHour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Budapest',
      hour: 'numeric',
      hour12: false,
    }).format(testDate),
    10
  )
  const offset = budapestHour - 12 // 1 or 2
  const utcHour = 18 - offset // 17:00 or 16:00 UTC

  return new Date(Date.UTC(prevY, prevM, prevD, utcHour, 0, 0, 0))
}

/**
 * Checks whether registration is currently open for the given event date.
 */
export function isRegistrationOpen(eventDateValue: string | Date, now: Date = new Date()): boolean {
  const deadline = getRegistrationDeadline(eventDateValue)
  return now.getTime() <= deadline.getTime()
}

/**
 * Returns a human-friendly formatted string of the registration deadline in Budapest time.
 * e.g. "2026. október 2., péntek 18:00"
 */
export function formatRegistrationDeadline(eventDateValue: string | Date): string {
  const deadline = getRegistrationDeadline(eventDateValue)
  if (deadline.getTime() === 0) return 'Ismeretlen határidő'
  return deadline.toLocaleDateString('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}