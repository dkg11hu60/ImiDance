import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Érvénytelen JSON kérés.' }, { status: 400 })
    }

    const { userId, partnerId } = body
    if (!userId) {
      return NextResponse.json({ error: 'Hiányzó userId.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[SET-PARTNER]: Supabase URL vagy Service Role Key hiányzik a környezeti változókból.')
      return NextResponse.json({ error: 'Szerver konfiguráció hiányzik.' }, { status: 500 })
    }

    // Service Role kliens az RLS szabályok megkerüléséhez (más felhasználó profilját is frissítjük)
    const admin = createClient(supabaseUrl, serviceKey)

    // 1. Jelenlegi profil lekérdezése (a régi partner beazonosításához)
    const { data: currentProfile, error: fetchErr } = await admin
      .from('profiles')
      .select('id, partner_id')
      .eq('id', userId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[SET-PARTNER FETCH ERROR]:', fetchErr)
      return NextResponse.json({ error: `Adatbázis hiba: ${fetchErr.message}` }, { status: 500 })
    }

    const oldPartnerId = currentProfile?.partner_id

    // 2. Ha új partner került kiválasztásra
    if (partnerId && partnerId !== 'none' && partnerId !== '') {
      if (oldPartnerId === partnerId) {
        return NextResponse.json({ ok: true, message: 'A partner már be van állítva.' })
      }

      // A) Ha volt régi partner, annak a partner_id mezőjét töröljük
      if (oldPartnerId) {
        await admin
          .from('profiles')
          .update({ partner_id: null })
          .eq('id', oldPartnerId)
      }

      // B) Ha a kiválasztott új partnernek már volt más valaki beállítva, annál is töröljük
      const { data: targetPartner } = await admin
        .from('profiles')
        .select('partner_id')
        .eq('id', partnerId)
        .maybeSingle()

      if (targetPartner?.partner_id) {
        await admin
          .from('profiles')
          .update({ partner_id: null })
          .eq('id', targetPartner.partner_id)
      }

      // C) Kétoldalú partnerkapcsolat rögzítése
      const { error: updateSelfErr } = await admin
        .from('profiles')
        .update({ partner_id: partnerId })
        .eq('id', userId)

      if (updateSelfErr) {
        console.error('[SET-PARTNER UPDATE SELF ERROR]:', updateSelfErr)
        return NextResponse.json({ error: `Mentési hiba: ${updateSelfErr.message}` }, { status: 500 })
      }

      const { error: updatePartnerErr } = await admin
        .from('profiles')
        .update({ partner_id: userId })
        .eq('id', partnerId)

      if (updatePartnerErr) {
        console.error('[SET-PARTNER UPDATE PARTNER ERROR]:', updatePartnerErr)
        return NextResponse.json({ error: `Partner mentési hiba: ${updatePartnerErr.message}` }, { status: 500 })
      }
    } else {
      // 3. Partner eltávolítása („Nincs partner” kiválasztása esetén)
      if (oldPartnerId) {
        await admin
          .from('profiles')
          .update({ partner_id: null })
          .eq('id', oldPartnerId)
      }

      const { error: clearErr } = await admin
        .from('profiles')
        .update({ partner_id: null })
        .eq('id', userId)

      if (clearErr) {
        console.error('[SET-PARTNER CLEAR ERROR]:', clearErr)
        return NextResponse.json({ error: `Törlési hiba: ${clearErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('[SET-PARTNER UNHANDLED ERROR]:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}