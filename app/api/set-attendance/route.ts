import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isRegistrationOpen } from '@/lib/utils'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Érvénytelen JSON kérés.' }, { status: 400 })
    }

    const { userId, eventId, attend } = body
    if (!userId || !eventId) {
      return NextResponse.json({ error: 'Hiányzó userId vagy eventId.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      console.error('[SET-ATTENDANCE]: Supabase URL or Service Role Key missing in environment variables.')
      return NextResponse.json({ error: 'Szerver konfiguráció hiányzik.' }, { status: 500 })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: ev, error: evError } = await admin
      .from('events')
      .select('id, title, is_active, event_date')
      .eq('id', eventId)
      .maybeSingle()

    if (evError) {
      console.error('[SET-ATTENDANCE EV ERROR]:', evError)
      return NextResponse.json({ error: `Adatbázis hiba az esemény lekérdezésekor: ${evError.message}` }, { status: 500 })
    }

    if (!ev) {
      return NextResponse.json({ error: 'Az esemény nem található.' }, { status: 404 })
    }

    if (ev.is_active === false && attend) {
      return NextResponse.json({ error: 'Erre az alkalomra már nem lehet jelentkezni.' }, { status: 400 })
    }

    if (!isRegistrationOpen(ev.event_date)) {
      return NextResponse.json(
        {
          error: attend
            ? 'A regisztráció lezárult. Minden eseményre a megelőző nap 18:00 óráig lehet regisztrálni.'
            : 'A lemondási határidő lezárult. Minden eseményre a megelőző nap 18:00 óráig lehet lemondani a részvételt.',
        },
        { status: 400 }
      )
    }

    const { data: me, error: meError } = await admin
      .from('profiles')
      .select('id, partner_id')
      .eq('id', userId)
      .maybeSingle()

    if (meError) {
      console.error('[SET-ATTENDANCE PROFILE ERROR]:', meError)
      return NextResponse.json({ error: `Adatbázis hiba a profil lekérdezésekor: ${meError.message}` }, { status: 500 })
    }

    if (!me) {
      return NextResponse.json({ error: 'A profil nem található.' }, { status: 404 })
    }

    const ids = [me.id]
    if (me.partner_id) {
      ids.push(me.partner_id)
    }

    if (attend) {
      const eventName = ev.title || 'Táncóra'
      const nowIso = new Date().toISOString()

      const rows = ids.map((pid) => ({
        profile_id: pid,
        event_id: eventId,
        event_name: eventName,
        status: 'registered',
        created_at: nowIso,
        cancelled_at: null,
      }))

      const { error: upsertError } = await admin
        .from('attendances')
        .upsert(rows, { onConflict: 'profile_id,event_id', ignoreDuplicates: false })

      if (upsertError) {
        console.error('[SET-ATTENDANCE UPSERT ERROR]:', upsertError)
        return NextResponse.json({ error: `Mentési hiba: ${upsertError.message}` }, { status: 500 })
      }

      // Log attend action
      for (const pid of ids) {
        try {
          await admin.from('activity_logs').insert({
            profile_id: pid,
            action: 'attend',
            event_id: eventId,
          })
        } catch (err: unknown) {
          console.error('[ACTIVITY-LOG ATTEND ERROR]:', err)
        }
      }
    } else {
      const nowIso = new Date().toISOString()

      const { error: updateError } = await admin
        .from('attendances')
        .update({
          status: 'cancelled',
          cancelled_at: nowIso,
        })
        .in('profile_id', ids)
        .eq('event_id', eventId)

      if (updateError) {
        console.error('[SET-ATTENDANCE CANCEL ERROR]:', updateError)
        return NextResponse.json({ error: `Lemondási hiba: ${updateError.message}` }, { status: 500 })
      }

      // Log cancel action
      for (const pid of ids) {
        try {
          await admin.from('activity_logs').insert({
            profile_id: pid,
            action: 'cancel',
            event_id: eventId,
          })
        } catch (err: unknown) {
          console.error('[ACTIVITY-LOG CANCEL ERROR]:', err)
        }
      }
    }

    return NextResponse.json({ ok: true, affected: ids })
  } catch (e: unknown) {
    console.error('[SET-ATTENDANCE UNHANDLED ERROR]:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}