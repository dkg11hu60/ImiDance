import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

// Tag-aktivitas: nev + szint + utolso login. Service role (auth.users olvasas).
// Csak a NEM letiltott tagok (profiles.is_active !== false).
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Szerver konfiguracio hianyzik." }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: profiles, error: pErr } = await admin
      .from("profiles")
      .select("id, full_name, dance_level, is_active")
    if (pErr) throw pErr

    // Szerepkörök lekérése a tanárok kiszűréséhez
    const { data: userRoles, error: rErr } = await admin
      .from("user_roles")
      .select("user_id, role_key")
    if (rErr) throw rErr

    const userRolesMap = new Map<string, string[]>()
    if (userRoles) {
      userRoles.forEach((ur: any) => {
        if (!userRolesMap.has(ur.user_id)) {
          userRolesMap.set(ur.user_id, [])
        }
        userRolesMap.get(ur.user_id)!.push(ur.role_key)
      })
    }

    const filteredProfiles = (profiles || []).filter((p: any) => {
      let roles = userRolesMap.get(p.id) || []
      if (roles.length === 0) {
        roles = ['user']
      }
      return roles.includes('user') || roles.includes('admin')
    })

    // Auth login-datumok, lapozva
    const authMap = new Map<string, string | null>()
    let page = 1
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
      if (error) throw error
      for (const u of data.users) authMap.set(u.id, u.last_sign_in_at ?? null)
      if (data.users.length < 1000) break
      page++
    }

    // Lekérjük az összes eseményt és a lezajlott (múltbéli) eseményeket szűrjük ki
    const { data: events, error: eErr } = await admin
      .from("events")
      .select("id, event_date, start_time, is_active")
    
    if (eErr) throw eErr

    const now = new Date()
    const pastEventIds = new Set(
      (events || [])
        .filter((ev: any) => {
          if (ev.is_active === false) return false
          const datePart = ev.event_date ? ev.event_date.split('T')[0] : ""
          const timePart = ev.start_time || "23:59:59"
          const eventEnd = new Date(`${datePart}T${timePart}`)
          return !isNaN(eventEnd.getTime()) && eventEnd <= now
        })
        .map((ev: any) => ev.id)
    )

    // Lekérjük az összes jelenléti bejegyzést
    const { data: attendances, error: attErr } = await admin
      .from("attendances")
      .select("profile_id, event_id, attended, status")
    
    if (attErr) throw attErr

    // Csak a befejeződött események aktív (nem lemondott) jelentkezéseit számítjuk be
    const pastAttendances = (attendances || []).filter((a: any) => {
      const isPast = pastEventIds.has(a.event_id)
      const isActive = (a.status ?? '') !== 'cancelled'
      return isPast && isActive
    })

    // Összesítjük a tagonkénti jelentkezések és megjelenések számát
    const statsMap = new Map<string, { registered: number; attended: number }>()
    pastAttendances.forEach((a: any) => {
      const pid = a.profile_id
      if (pid) {
        if (!statsMap.has(pid)) {
          statsMap.set(pid, { registered: 0, attended: 0 })
        }
        const stat = statsMap.get(pid)!
        stat.registered += 1
        if (a.attended === true) {
          stat.attended += 1
        }
      }
    })

    const rows = filteredProfiles.map((p: any) => {
      const stats = statsMap.get(p.id) || { registered: 0, attended: 0 }
      const registeredCount = stats.registered
      const attendedCount = stats.attended
      const missedCount = registeredCount - attendedCount
      
      const absenceRate = registeredCount > 0 ? Math.round((missedCount / registeredCount) * 100) : 0
      const hasAbsenceWarning = registeredCount > 0 && absenceRate > 50

      return {
        id: p.id,
        full_name: p.full_name,
        dance_level: p.dance_level || null,
        last_sign_in_at: authMap.get(p.id) ?? null,
        is_active: p.is_active !== false,
        has_absence_warning: hasAbsenceWarning,
        held_event_count: registeredCount,
        missed_count: missedCount,
        absence_rate: absenceRate,
      }
    })
    rows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "hu"))

    return NextResponse.json({ members: rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Szerverhiba"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
