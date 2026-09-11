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

    const activeProfiles = (profiles || []).filter((p: any) => {
      if (p.is_active === false) return false

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

    const rows = activeProfiles.map((p: any) => ({
      full_name: p.full_name,
      dance_level: p.dance_level || null,
      last_sign_in_at: authMap.get(p.id) ?? null,
    }))
    rows.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "", "hu"))

    return NextResponse.json({ members: rows })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Szerverhiba"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
