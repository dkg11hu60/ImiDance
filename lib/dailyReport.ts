import { createClient } from '@supabase/supabase-js'
import { getMailTransporter, getMailSender } from './email'
import { toDateKey, isRegistrationOpen, formatRegistrationDeadline } from './utils'

export interface DailyReportOptions {
  force?: boolean
  recipientOverride?: string
  ccOverride?: string
}

export interface DailyReportResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  recipient?: string
  cc?: string
  subject?: string
  messageId?: string
  budapestDate?: string
  budapestTime?: string
  eventSummary?: {
    id: string
    title: string
    date: string
    isToday: boolean
    registeredCount: number
    girlsCount: number
    boysCount: number
    monthlyPassCount: number
  } | null
  recentRegistrationsCount?: number
  upcomingEventsCount?: number
  error?: string
}

interface EventRecord {
  id: string
  title?: string | null
  event_date: string
  start_time?: string | null
  end_time?: string | null
  is_active?: boolean
  location_id?: string | null
  locations?: {
    id: string
    name: string
    address?: string | null
  } | null
}

interface ProfileRecord {
  id: string
  name?: string | null
  full_name?: string | null
  first_name?: string | null
  last_name?: string | null
  gender?: string | null
  dance_level?: string | null
  partner_id?: string | null
  is_active?: boolean
}

interface AttendanceRecord {
  id: string
  profile_id: string
  event_id: string
  event_name?: string | null
  status?: string | null
  attended?: boolean
  paid?: boolean
  created_at: string
  cancelled_at?: string | null
}

function formatLongDateBudapest(dateStr: string): string {
  const parts = toDateKey(dateStr).split('-')
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('hu-HU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    }
  }
  return dateStr
}

function formatTimestampBudapest(timestamp?: string | null): string {
  if (!timestamp) return '—'
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return timestamp
  const datePart = d.toLocaleDateString('hu-HU', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const timePart = d.toLocaleTimeString('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${datePart} ${timePart}`
}

function escapeHtml(text?: string | null): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Generates the daily registration report and delivers it via email to imredance@gmail.com.
 */
export async function generateAndSendDailyReport(
  options: DailyReportOptions = {}
): Promise<DailyReportResult> {
  const now = new Date()

  // 1. Check time zone and target hour (17:01 UTC = 19:01 CEST in summer, 18:01 CET in winter)
  const budapestHour = parseInt(
    new Intl.DateTimeFormat('hu-HU', {
      timeZone: 'Europe/Budapest',
      hour: '2-digit',
      hour12: false,
    }).format(now),
    10
  )

  const budapestTimeStr = new Intl.DateTimeFormat('hu-HU', {
    timeZone: 'Europe/Budapest',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now)

  const budapestDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now) // Format: YYYY-MM-DD

  // When triggered via cron without force flag, only execute during the 18:00 or 19:00 hour (winter vs summer time)
  if (!options.force && budapestHour !== 18 && budapestHour !== 19) {
    return {
      ok: true,
      skipped: true,
      reason: `Jelenlegi budapesti idő: ${budapestTimeStr}. A napi automatikus riport 18:01-kor (télen) vagy 19:01-kor (nyáron) fut le.`,
      budapestDate: budapestDateStr,
      budapestTime: budapestTimeStr,
    }
  }

  // 2. Initialize Supabase Admin client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Hiányzó Supabase konfiguráció (NEXT_PUBLIC_SUPABASE_URL vagy SUPABASE_SERVICE_ROLE_KEY).')
  }
  const admin = createClient(supabaseUrl, serviceKey)

  // 3. Fetch all active events
  const { data: rawEvents, error: evError } = await admin
    .from('events')
    .select('id, title, event_date, start_time, end_time, is_active, location_id, locations(id, name, address)')
    .neq('is_active', false)
    .order('event_date', { ascending: true })

  if (evError) {
    throw new Error(`Hiba az események lekérdezésekor: ${evError.message}`)
  }

  const events: EventRecord[] = (rawEvents || []) as any

  // Filter events: today's events vs tomorrow's events vs future events
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Budapest',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(tomorrowDate)

  const todayEvents = events.filter((ev) => toDateKey(ev.event_date) === budapestDateStr)
  const tomorrowEvents = events.filter((ev) => toDateKey(ev.event_date) === tomorrowDateStr)
  const futureEvents = events.filter((ev) => toDateKey(ev.event_date) > budapestDateStr)

  // Determine focus event: today's event if exists, otherwise tomorrow's event, otherwise earliest upcoming
  const isTodayClass = todayEvents.length > 0
  const isTomorrowClass = !isTodayClass && tomorrowEvents.length > 0
  const focusEvent: EventRecord | null = isTodayClass
    ? todayEvents[0]
    : isTomorrowClass
    ? tomorrowEvents[0]
    : futureEvents[0] || null

  // 4. Fetch all profiles
  const { data: rawProfiles, error: profError } = await admin
    .from('profiles')
    .select('id, name, full_name, first_name, last_name, gender, dance_level, partner_id, is_active')
    .neq('is_active', false)

  if (profError) {
    throw new Error(`Hiba a profilok lekérdezésekor: ${profError.message}`)
  }

  const profiles = (rawProfiles || []) as ProfileRecord[]
  const profileMap = new Map<string, ProfileRecord>()
  profiles.forEach((p) => {
    profileMap.set(p.id, p)
  })

  // 5. Gather relevant event IDs
  const relevantEventIds: string[] = []
  if (focusEvent) relevantEventIds.push(focusEvent.id)
  futureEvents.forEach((ev) => {
    if (!relevantEventIds.includes(ev.id)) relevantEventIds.push(ev.id)
  })

  // 6. Fetch attendances for relevant events (both registered and cancelled)
  let attendances: AttendanceRecord[] = []
  if (relevantEventIds.length > 0) {
    const { data: rawAtts, error: attError } = await admin
      .from('attendances')
      .select('id, profile_id, event_id, event_name, status, attended, paid, created_at, cancelled_at')
      .in('event_id', relevantEventIds)

    if (attError) {
      throw new Error(`Hiba a jelenlétek lekérdezésekor: ${attError.message}`)
    }
    attendances = (rawAtts || []) as AttendanceRecord[]
  }

  // 7. Fetch monthly passes for the focus event month
  let monthlyPassUserIds = new Set<string>()
  if (focusEvent) {
    const focusDateKey = toDateKey(focusEvent.event_date)
    const [fYear, fMonth] = focusDateKey.split('-').map((n) => parseInt(n, 10))
    if (fYear && fMonth) {
      const { data: rawPasses } = await admin
        .from('monthly_passes')
        .select('profile_id')
        .eq('year', fYear)
        .eq('month', fMonth)

      if (rawPasses) {
        rawPasses.forEach((mp: any) => {
          if (mp.profile_id) monthlyPassUserIds.add(mp.profile_id)
        })
      }
    }
  }

  // 8. Fetch registrations and cancellations in the last 24 hours
  const past24hIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: rawRecentAtts } = await admin
    .from('attendances')
    .select('id, profile_id, event_id, event_name, status, created_at, cancelled_at')
    .gte('created_at', past24hIso)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })

  const recentRegistrations = (rawRecentAtts || []) as AttendanceRecord[]

  const { data: rawRecentCancellations } = await admin
    .from('attendances')
    .select('id, profile_id, event_id, event_name, status, created_at, cancelled_at')
    .gte('cancelled_at', past24hIso)
    .eq('status', 'cancelled')
    .order('cancelled_at', { ascending: false })

  const recentCancellations = (rawRecentCancellations || []) as AttendanceRecord[]

  // 9. Process focus event attendees
  interface AttendeeRow {
    profileId: string
    name: string
    gender: string
    danceLevel: string
    partnerName?: string
    isPartnerRegistered: boolean
    hasMonthlyPass: boolean
    registeredAt: string
  }

  const focusAttendees: AttendeeRow[] = []
  const focusAttMap = new Map<string, AttendanceRecord>()

  if (focusEvent) {
    attendances
      .filter((a) => a.event_id === focusEvent.id && (a.status === 'registered' || a.status === 'X'))
      .forEach((a) => {
        focusAttMap.set(a.profile_id, a)
      })

    focusAttMap.forEach((att, profileId) => {
      const p = profileMap.get(profileId)
      const name = p?.full_name || (p?.first_name && p?.last_name ? `${p.last_name} ${p.first_name}` : p?.name) || 'Ismeretlen táncos'
      const gender = p?.gender || '—'
      const danceLevel = p?.dance_level || '—'

      let partnerName: string | undefined
      let isPartnerRegistered = false
      if (p?.partner_id) {
        const partner = profileMap.get(p.partner_id)
        if (partner) {
          partnerName = partner.full_name || partner.name || 'Partner'
          isPartnerRegistered = focusAttMap.has(p.partner_id)
        }
      }

      focusAttendees.push({
        profileId,
        name,
        gender,
        danceLevel,
        partnerName,
        isPartnerRegistered,
        hasMonthlyPass: monthlyPassUserIds.has(profileId),
        registeredAt: att.created_at,
      })
    })

    // Sort attendees: first by registration time (earliest first)
    focusAttendees.sort((a, b) => new Date(a.registeredAt).getTime() - new Date(b.registeredAt).getTime())
  }

  // Cancelled attendees for focus event
  interface CancelledRow {
    name: string
    gender: string
    danceLevel: string
    cancelledAt: string
  }

  const focusCancelled: CancelledRow[] = []
  if (focusEvent) {
    attendances
      .filter((a) => a.event_id === focusEvent.id && a.status === 'cancelled')
      .forEach((a) => {
        const p = profileMap.get(a.profile_id)
        const name = p?.full_name || (p?.first_name && p?.last_name ? `${p.last_name} ${p.first_name}` : p?.name) || 'Táncos'
        focusCancelled.push({
          name,
          gender: p?.gender || '—',
          danceLevel: p?.dance_level || '—',
          cancelledAt: a.cancelled_at || a.created_at,
        })
      })
  }

  // Calculate statistics for the focus event
  const totalRegistered = focusAttendees.length
  let girlsCount = 0
  let boysCount = 0
  let otherGenderCount = 0
  let monthlyPassCount = 0

  focusAttendees.forEach((row) => {
    const g = row.gender.toLowerCase()
    if (g.includes('lány') || g.includes('nő') || g === 'l') {
      girlsCount++
    } else if (g.includes('fiú') || g.includes('férfi') || g === 'f') {
      boysCount++
    } else {
      otherGenderCount++
    }

    if (row.hasMonthlyPass) {
      monthlyPassCount++
    }
  })

  // Couples count (each couple counted once)
  let coupledDancersCount = focusAttendees.filter((a) => a.isPartnerRegistered).length
  const confirmedCouplesCount = Math.floor(coupledDancersCount / 2)
  const singleDancersCount = totalRegistered - coupledDancersCount

  // Balance text
  let balanceText = 'Kiegyensúlyozott (egyenlő létszám)'
  let balanceColor = '#059669' // green
  if (girlsCount > boysCount) {
    const diff = girlsCount - boysCount
    balanceText = `+${diff} hölgy többlet (${girlsCount} lány / ${boysCount} fiú)`
    balanceColor = '#d97706' // amber
  } else if (boysCount > girlsCount) {
    const diff = boysCount - girlsCount
    balanceText = `+${diff} úr többlet (${boysCount} fiú / ${girlsCount} lány)`
    balanceColor = '#2563eb' // blue
  }

  // 10. Process upcoming events list
  interface UpcomingSummary {
    id: string
    title: string
    dateFormatted: string
    dateKey: string
    startTime: string
    locationName: string
    totalCount: number
    girlsCount: number
    boysCount: number
    isOpen: boolean
    deadlineText: string
  }

  const upcomingList: UpcomingSummary[] = futureEvents
    .filter((ev) => !focusEvent || ev.id !== focusEvent.id)
    .slice(0, 5)
    .map((ev) => {
      const evAtts = attendances.filter((a) => a.event_id === ev.id && (a.status === 'registered' || a.status === 'X'))
      let gCount = 0
      let bCount = 0
      evAtts.forEach((a) => {
        const p = profileMap.get(a.profile_id)
        const g = (p?.gender || '').toLowerCase()
        if (g.includes('lány') || g.includes('nő') || g === 'l') gCount++
        else if (g.includes('fiú') || g.includes('férfi') || g === 'f') bCount++
      })

      return {
        id: ev.id,
        title: ev.title || 'Táncóra',
        dateFormatted: formatLongDateBudapest(ev.event_date),
        dateKey: toDateKey(ev.event_date),
        startTime: (ev.start_time || '18:30').slice(0, 5),
        locationName: ev.locations?.name || 'Helyszín nincs megadva',
        totalCount: evAtts.length,
        girlsCount: gCount,
        boysCount: bCount,
        isOpen: isRegistrationOpen(ev.event_date),
        deadlineText: formatRegistrationDeadline(ev.event_date),
      }
    })

  // 11. Process recent signups (last 24 hours)
  const eventMap = new Map<string, EventRecord>()
  events.forEach((e) => eventMap.set(e.id, e))

  interface RecentSignupRow {
    name: string
    gender: string
    eventTitle: string
    eventDate: string
    registeredAt: string
  }

  const recentSignupsFormatted: RecentSignupRow[] = recentRegistrations
    .map((att) => {
      const p = profileMap.get(att.profile_id)
      const ev = eventMap.get(att.event_id)
      const name = p?.full_name || (p?.first_name && p?.last_name ? `${p.last_name} ${p.first_name}` : p?.name) || 'Táncos'
      const evTitle = ev?.title || att.event_name || 'Táncóra'
      const evDate = ev ? formatLongDateBudapest(ev.event_date) : 'Ismeretlen dátum'
      return {
        name,
        gender: p?.gender || '—',
        eventTitle: evTitle,
        eventDate: evDate,
        registeredAt: formatTimestampBudapest(att.created_at),
      }
    })
    .slice(0, 15)

  interface RecentCancellationRow {
    name: string
    gender: string
    eventTitle: string
    eventDate: string
    cancelledAt: string
  }

  const recentCancellationsFormatted: RecentCancellationRow[] = recentCancellations
    .map((att) => {
      const p = profileMap.get(att.profile_id)
      const ev = eventMap.get(att.event_id)
      const name = p?.full_name || (p?.first_name && p?.last_name ? `${p.last_name} ${p.first_name}` : p?.name) || 'Táncos'
      const evTitle = ev?.title || att.event_name || 'Táncóra'
      const evDate = ev ? formatLongDateBudapest(ev.event_date) : 'Ismeretlen dátum'
      return {
        name,
        gender: p?.gender || '—',
        eventTitle: evTitle,
        eventDate: evDate,
        cancelledAt: formatTimestampBudapest(att.cancelled_at || att.created_at),
      }
    })
    .slice(0, 15)

  // 12. Build Responsive HTML Email Template
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://imidance.vercel.app'
  const recipient = (options.recipientOverride || process.env.DAILY_REPORT_EMAIL || 'imredance@gmail.com').trim()
  const cc = (options.ccOverride !== undefined ? options.ccOverride : (process.env.DAILY_REPORT_CC_EMAIL || 'dkg11hu@gmail.com')).trim()

  const focusEventTitle = focusEvent?.title || 'Táncóra'
  const focusEventDateLong = focusEvent ? formatLongDateBudapest(focusEvent.event_date) : ''
  const focusEventTime = focusEvent?.start_time ? focusEvent.start_time.slice(0, 5) : '18:30'
  const focusEventLocation = focusEvent?.locations
    ? `${focusEvent.locations.name}${focusEvent.locations.address ? ` (${focusEvent.locations.address})` : ''}`
    : 'Helyszín nincs megadva'

  const focusIsOpen = focusEvent ? isRegistrationOpen(focusEvent.event_date) : false
  const focusDeadlineText = focusEvent ? formatRegistrationDeadline(focusEvent.event_date) : ''

  const subject = isTodayClass
    ? `[ImiDance Riport] Mai táncóra jelentkezések - ${budapestDateStr} (${budapestTimeStr})`
    : isTomorrowClass
    ? `[ImiDance Riport] Holnapi táncóra végleges létszáma - ${tomorrowDateStr} (${budapestTimeStr})`
    : `[ImiDance Riport] Napi jelentkezési összesítő - ${budapestDateStr} (${budapestTimeStr})`

  const htmlContent = `
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f1f5f9; padding: 24px 12px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 680px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%); padding: 28px 24px; color: #ffffff; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: rgba(255, 255, 255, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                      Napi Automata Riport • ${budapestTimeStr}
                    </span>
                    <h1 style="margin: 10px 0 4px 0; font-size: 22px; font-weight: 800; line-height: 1.3;">
                      ImiDance Táncóra Jelentkezések
                    </h1>
                    <p style="margin: 0; font-size: 13px; color: #c7d2fe;">
                      Készült: ${budapestDateStr} ${budapestTimeStr} (Budapesti idő)
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Status Highlight Bar -->
          <tr>
            <td style="padding: 16px 24px; background-color: ${isTodayClass ? '#ecfdf5' : isTomorrowClass ? '#fffbeb' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    ${
                      isTodayClass
                        ? `<span style="font-size: 14px; font-weight: 700; color: #065f46;">
                            🟢 MAI TÁNCÓRA: ${escapeHtml(focusEventTitle)} (${escapeHtml(focusEventTime)})
                           </span>`
                        : isTomorrowClass
                        ? `<span style="font-size: 14px; font-weight: 700; color: #b45309;">
                            🔒 HOLNAPI TÁNCÓRA (Végleges létszám, a regisztráció lezárult): ${escapeHtml(focusEventTitle)} (${escapeHtml(focusEventTime)})
                           </span>`
                        : focusEvent
                        ? `<span style="font-size: 14px; font-weight: 700; color: #1e40af;">
                            📅 KÖVETKEZŐ TÁNCÓRA: ${escapeHtml(focusEventDateLong)} (${escapeHtml(focusEventTime)})
                           </span>`
                        : `<span style="font-size: 14px; font-weight: 700; color: #64748b;">
                            ℹ️ Nincs aktív kitűzött táncóra a közeljövőben.
                           </span>`
                    }
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Focus Event Section -->
          ${
            focusEvent
              ? `
          <tr>
            <td style="padding: 24px;">
              <!-- Event Header Info -->
              <div style="margin-bottom: 20px;">
                <h2 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: #0f172a;">
                  ${isTodayClass ? 'Mai Táncóra Részletei' : isTomorrowClass ? 'Holnapi Táncóra Részletei (Végleges)' : 'Következő Táncóra Részletei'}
                </h2>
                <div style="font-size: 13px; color: #64748b; line-height: 1.6;">
                  📍 <strong>Helyszín:</strong> ${escapeHtml(focusEventLocation)}<br>
                  ⏰ <strong>Időpont:</strong> ${escapeHtml(focusEventDateLong)}, ${escapeHtml(focusEventTime)}<br>
                  ${
                    focusIsOpen
                      ? `⏳ <strong>Jelentkezési határidő:</strong> <span style="color: #059669; font-weight: 700;">${escapeHtml(focusDeadlineText)}</span>`
                      : `🔒 <strong>Jelentkezési határidő:</strong> <span style="color: #d97706; font-weight: 700;">Lezárult (${escapeHtml(focusDeadlineText)})</span>`
                  }
                </div>
              </div>

              <!-- Metrics Cards Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td width="25%" style="padding: 4px;">
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase;">Jelentkezők</div>
                      <div style="font-size: 22px; font-weight: 800; color: #4338ca; margin-top: 4px;">${totalRegistered}</div>
                      <div style="font-size: 10px; color: #94a3b8;">fő regisztrált</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 4px;">
                    <div style="background-color: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 12px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 11px; font-weight: 600; color: #be185d; text-transform: uppercase;">Hölgyek</div>
                      <div style="font-size: 22px; font-weight: 800; color: #db2777; margin-top: 4px;">${girlsCount}</div>
                      <div style="font-size: 10px; color: #f472b6;">lány táncos</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 4px;">
                    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 11px; font-weight: 600; color: #1d4ed8; text-transform: uppercase;">Urak</div>
                      <div style="font-size: 22px; font-weight: 800; color: #2563eb; margin-top: 4px;">${boysCount}</div>
                      <div style="font-size: 10px; color: #60a5fa;">fiú táncos</div>
                    </div>
                  </td>
                  <td width="25%" style="padding: 4px;">
                    <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 12px 8px; text-align: center;">
                      <div style="font-size: 11px; font-weight: 600; color: #047857; text-transform: uppercase;">Párok</div>
                      <div style="font-size: 22px; font-weight: 800; color: #059669; margin-top: 4px;">${confirmedCouplesCount}</div>
                      <div style="font-size: 10px; color: #34d399;">párban</div>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Balance Banner -->
              <div style="background-color: #f8fafc; border-left: 4px solid ${balanceColor}; padding: 10px 14px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-size: 13px;">
                <strong>Nemi egyensúly:</strong> <span style="color: ${balanceColor}; font-weight: 700;">${escapeHtml(balanceText)}</span>
                ${
                  singleDancersCount > 0
                    ? ` • <em>Egyéni (pár nélküli) jelentkezők: ${singleDancersCount} fő</em>`
                    : ''
                }
                ${
                  monthlyPassCount > 0
                    ? `<br><span style="font-size: 12px; color: #475569;">🎫 Havi bérlettel rendelkezők: <strong>${monthlyPassCount} fő</strong> | Alkalmi órajegyesek: <strong>${totalRegistered - monthlyPassCount} fő</strong></span>`
                    : ''
                }
              </div>

              <!-- Attendees Table -->
              <h3 style="font-size: 14px; font-weight: 700; margin: 0 0 10px 0; color: #334155;">
                Regisztrált Táncosok Listája (${totalRegistered} fő)
              </h3>

              ${
                focusAttendees.length === 0
                  ? `<p style="font-size: 13px; color: #94a3b8; font-style: italic; margin: 12px 0;">Erre az alkalomra még nem érkezett előzetes jelentkezés.</p>`
                  : `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0; text-align: left; color: #475569;">
                    <th style="padding: 10px 8px; width: 30px; text-align: center;">#</th>
                    <th style="padding: 10px 8px;">Név</th>
                    <th style="padding: 10px 8px; width: 65px; text-align: center;">Nem</th>
                    <th style="padding: 10px 8px; width: 85px;">Szint</th>
                    <th style="padding: 10px 8px;">Partner státusz</th>
                    <th style="padding: 10px 8px; width: 75px; text-align: center;">Fizetés</th>
                    <th style="padding: 10px 8px; width: 105px; text-align: right;">Jelentkezés</th>
                  </tr>
                </thead>
                <tbody>
                  ${focusAttendees
                    .map((dancer, idx) => {
                      const isLady = dancer.gender.toLowerCase().includes('lány') || dancer.gender.toLowerCase().includes('nő') || dancer.gender === 'Lány'
                      const isGent = dancer.gender.toLowerCase().includes('fiú') || dancer.gender.toLowerCase().includes('férfi') || dancer.gender === 'Fiú'
                      const genderBadge = isLady
                        ? `<span style="background-color: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">Lány</span>`
                        : isGent
                        ? `<span style="background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 10px;">Fiú</span>`
                        : `<span style="color: #94a3b8;">${escapeHtml(dancer.gender)}</span>`

                      const passBadge = dancer.hasMonthlyPass
                        ? `<span style="background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; padding: 2px 5px; border-radius: 4px; font-weight: 700; font-size: 10px;">Bérlet</span>`
                        : `<span style="color: #64748b; font-size: 11px;">Alkalmi</span>`

                      const partnerInfo = dancer.partnerName
                        ? dancer.isPartnerRegistered
                          ? `<span style="color: #6d28d9; font-weight: 600;">👫 ${escapeHtml(dancer.partnerName)}</span>`
                          : `<span style="color: #94a3b8;">👤 ${escapeHtml(dancer.partnerName)} (nincs itt)</span>`
                        : `<span style="color: #94a3b8;">Egyéni</span>`

                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'

                      return `
                      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 8px; text-align: center; color: #94a3b8; font-size: 11px;">${idx + 1}</td>
                        <td style="padding: 8px; font-weight: 700; color: #0f172a;">${escapeHtml(dancer.name)}</td>
                        <td style="padding: 8px; text-align: center;">${genderBadge}</td>
                        <td style="padding: 8px; color: #475569; font-size: 11px;">${escapeHtml(dancer.danceLevel)}</td>
                        <td style="padding: 8px; font-size: 11px;">${partnerInfo}</td>
                        <td style="padding: 8px; text-align: center;">${passBadge}</td>
                        <td style="padding: 8px; text-align: right; font-family: monospace; font-size: 11px; color: #64748b; white-space: nowrap;">
                          ${escapeHtml(formatTimestampBudapest(dancer.registeredAt))}
                        </td>
                      </tr>
                      `
                    })
                    .join('')}
                </tbody>
              </table>
              `
              }

              ${
                focusCancelled.length > 0
                  ? `
              <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 10px 14px; margin-top: 14px; font-size: 12px; color: #9f1239;">
                <strong>⚠️ Határidő előtt lemondott jelentkezések erre az órára (${focusCancelled.length} fő):</strong>
                <ul style="margin: 6px 0 0 0; padding-left: 18px; line-height: 1.5;">
                  ${focusCancelled
                    .map(
                      (c) =>
                        `<li><strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.gender)}, ${escapeHtml(c.danceLevel)}) — lemondva: ${escapeHtml(formatTimestampBudapest(c.cancelledAt))}</li>`
                    )
                    .join('')}
                </ul>
              </div>
              `
                  : ''
              }
            </td>
          </tr>
          `
              : ''
          }

          <!-- Upcoming Events Overview Section -->
          ${
            upcomingList.length > 0
              ? `
          <tr>
            <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #1e293b;">
                Következő Órák Áttekintése (Előzetes jelentkezések)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="border-bottom: 1px solid #cbd5e1; text-align: left; color: #64748b;">
                    <th style="padding: 6px 8px;">Dátum</th>
                    <th style="padding: 6px 8px;">Óra</th>
                    <th style="padding: 6px 8px;">Helyszín</th>
                    <th style="padding: 6px 8px; text-align: right;">Jelentkezők száma</th>
                  </tr>
                </thead>
                <tbody>
                  ${upcomingList
                    .map((up, idx) => {
                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f1f5f9'
                      return `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px; font-weight: 700; color: #0f172a;">${escapeHtml(up.dateFormatted)}</td>
                      <td style="padding: 8px; color: #334155;">${escapeHtml(up.title)} (${escapeHtml(up.startTime)})</td>
                      <td style="padding: 8px; color: #64748b;">
                        ${escapeHtml(up.locationName)}<br>
                        <span style="font-size: 10px; color: ${up.isOpen ? '#059669' : '#d97706'}; font-weight: 600;">
                          ${up.isOpen ? '⏳ Határidő: ' + escapeHtml(up.deadlineText) : '🔒 Regisztráció lezárult'}
                        </span>
                      </td>
                      <td style="padding: 8px; text-align: right; font-weight: 700; color: #4338ca;">
                        ${up.totalCount} fő <span style="font-weight: 400; font-size: 11px; color: #64748b;">(${up.girlsCount} lány / ${up.boysCount} fiú)</span>
                      </td>
                    </tr>
                    `
                    })
                    .join('')}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- New Signups in Last 24h -->
          <tr>
            <td style="padding: 20px 24px; border-top: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #1e293b;">
                ⚡ Új Jelentkezések az Elmúlt 24 Órában (${recentSignupsFormatted.length} db)
              </h3>
              ${
                recentSignupsFormatted.length === 0
                  ? `<p style="margin: 0; font-size: 12px; color: #94a3b8; font-style: italic;">Az elmúlt 24 órában nem történt új eseményre jelentkezés.</p>`
                  : `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="border-bottom: 1px solid #e2e8f0; text-align: left; color: #64748b;">
                    <th style="padding: 6px 8px;">Táncos</th>
                    <th style="padding: 6px 8px;">Nem</th>
                    <th style="padding: 6px 8px;">Esemény</th>
                    <th style="padding: 6px 8px; text-align: right;">Időpont</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentSignupsFormatted
                    .map((r, idx) => {
                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#f8fafc'
                      return `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #f1f5f9;">
                      <td style="padding: 6px 8px; font-weight: 700; color: #0f172a;">${escapeHtml(r.name)}</td>
                      <td style="padding: 6px 8px; color: #64748b;">${escapeHtml(r.gender)}</td>
                      <td style="padding: 6px 8px; color: #334155;">${escapeHtml(r.eventTitle)} <span style="font-size: 11px; color: #94a3b8;">(${escapeHtml(r.eventDate)})</span></td>
                      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px; color: #64748b;">${escapeHtml(r.registeredAt)}</td>
                    </tr>
                    `
                    })
                    .join('')}
                </tbody>
              </table>
              `
              }
            </td>
          </tr>

          <!-- Recent Cancellations in Last 24h (if any) -->
          ${
            recentCancellationsFormatted.length > 0
              ? `
          <tr>
            <td style="padding: 20px 24px; border-top: 1px solid #fed7aa; background-color: #fffaf0;">
              <h3 style="margin: 0 0 10px 0; font-size: 15px; font-weight: 700; color: #9a3412;">
                🔻 Lemondások az Elmúlt 24 Órában (${recentCancellationsFormatted.length} db)
              </h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="border-bottom: 1px solid #fed7aa; text-align: left; color: #9a3412;">
                    <th style="padding: 6px 8px;">Táncos</th>
                    <th style="padding: 6px 8px;">Nem</th>
                    <th style="padding: 6px 8px;">Esemény</th>
                    <th style="padding: 6px 8px; text-align: right;">Lemondás ideje</th>
                  </tr>
                </thead>
                <tbody>
                  ${recentCancellationsFormatted
                    .map((r, idx) => {
                      const rowBg = idx % 2 === 0 ? '#ffffff' : '#fff7ed'
                      return `
                    <tr style="background-color: ${rowBg}; border-bottom: 1px solid #fed7aa;">
                      <td style="padding: 6px 8px; font-weight: 700; color: #7c2d12;">${escapeHtml(r.name)}</td>
                      <td style="padding: 6px 8px; color: #9a3412;">${escapeHtml(r.gender)}</td>
                      <td style="padding: 6px 8px; color: #431407;">${escapeHtml(r.eventTitle)} <span style="font-size: 11px; color: #9a3412;">(${escapeHtml(r.eventDate)})</span></td>
                      <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 11px; color: #c2410c;">${escapeHtml(r.cancelledAt)}</td>
                    </tr>
                    `
                    })
                    .join('')}
                </tbody>
              </table>
            </td>
          </tr>
          `
              : ''
          }

          <!-- Action Button & Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <a href="${siteUrl}" style="display: inline-block; background-color: #4338ca; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 2px 8px rgba(67, 56, 202, 0.3);">
                ImiDance Rendszer Megnyitása
              </a>
              <p style="margin: 16px 0 0 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Ez az e-mail automatikusan generálódott a táncórák jelentkezéseinek nyomon követésére.<br>
                Címzett: <strong>${escapeHtml(recipient)}</strong>${cc ? ` • Másolat (CC): <strong>${escapeHtml(cc)}</strong>` : ''} • ImiDance Riport Rendszer
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `

  // 13. Send email using Nodemailer
  const transporter = getMailTransporter()
  const sender = getMailSender('Riport')

  const sendResult = await transporter.sendMail({
    from: sender,
    to: recipient,
    ...(cc ? { cc } : {}),
    subject: subject,
    html: htmlContent,
  })

  return {
    ok: true,
    recipient: recipient,
    cc: cc || undefined,
    subject: subject,
    messageId: sendResult.messageId,
    budapestDate: budapestDateStr,
    budapestTime: budapestTimeStr,
    eventSummary: focusEvent
      ? {
          id: focusEvent.id,
          title: focusEventTitle,
          date: focusEvent.event_date,
          isToday: isTodayClass,
          registeredCount: totalRegistered,
          girlsCount,
          boysCount,
          monthlyPassCount,
        }
      : null,
    recentRegistrationsCount: recentRegistrations.length,
    upcomingEventsCount: upcomingList.length,
  }
}
