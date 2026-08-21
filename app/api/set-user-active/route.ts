import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { userId, active } = await req.json()

    if (!userId || typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Hiányzó userId vagy active.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Szerver konfiguráció hiányzik.' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    // 1) Profil-flag (a felület és a lekérdezések ezt olvassák)
    const { error: pErr } = await admin
      .from('profiles')
      .update({ is_active: active })
      .eq('id', userId)
    if (pErr) {
      return NextResponse.json({ error: 'Profil frissítési hiba: ' + pErr.message }, { status: 500 })
    }

    // 2) Auth-szintű tiltás: inaktiválásnál ban, visszakapcsolásnál feloldás.
    const { error: aErr } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? 'none' : '876000h', // ~100 év = „végleges”, visszakapcsolható
    })
    if (aErr) {
      return NextResponse.json({ error: 'Auth tiltási hiba: ' + aErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, active })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Szerverhiba'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}