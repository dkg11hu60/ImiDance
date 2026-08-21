import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: Request) {
  try {
    const { eventId, subject, body } = await req.json()

    if (!eventId) {
      return NextResponse.json({ error: 'A feladathoz hiányzik az eventId azonosító.' }, { status: 400 })
    }

    // 1. Az esemény inaktiválása az adatbázisban
    const { error: dbError } = await supabaseAdmin
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId)

    if (dbError) {
      return NextResponse.json({ error: `Adatbázis frissítési hiba: ${dbError.message}` }, { status: 500 })
    }

    // 2. Jelentkezők lekérdezése
    const { data: atts, error: attsErr } = await supabaseAdmin
      .from('attendances')
      .select('*')

    if (attsErr) {
      return NextResponse.json({ error: `Jelentkezők lekérdezési hiba: ${attsErr.message}` }, { status: 500 })
    }

    const eventAtts = (atts || []).filter((a: any) => {
      const eId = a.event_id || a.event
      return String(eId) === String(eventId)
    })

    const profileIds = Array.from(
      new Set(eventAtts.map((a: any) => a.profile_id || a.user_id).filter(Boolean))
    )

    const sentList: any[] = []
    const skippedNoEmail: any[] = []
    const failedEmails: any[] = []

    if (profileIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds)

      const smtpHost = process.env.SMTP_HOST
      const smtpPort = Number(process.env.SMTP_PORT) || 587
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS
      const smtpSecure = process.env.SMTP_SECURE === 'true'
      const fromEmail = process.env.SMTP_FROM || smtpUser || 'no-reply@imisdance.local'

      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({
          error: 'Hiányzó SMTP konfiguráció a .env.local fájlban (SMTP_HOST, SMTP_USER, SMTP_PASS).'
        }, { status: 500 })
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false
        }
      })

      for (const prof of profiles || []) {
        const name = prof.full_name || 'Táncos'
        const email = (prof.email || '').trim()

        if (!email || email.endsWith('@imisdance.local')) {
          skippedNoEmail.push({ name })
          continue
        }

        const customizedBody = body ? body.replace(/\{\{nev\}\}/g, name) : ''

        try {
          await transporter.sendMail({
            from: `"ImiDance" <${fromEmail}>`,
            to: email,
            subject: subject || 'Esemény törölve',
            text: customizedBody,
          })
          sentList.push({ email, name })
        } catch (sendErr: any) {
          console.error(`SMTP küldési hiba (${email}):`, sendErr)
          failedEmails.push({ email, name, error: sendErr?.message || 'Ismeretlen SMTP hiba' })
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentList,
      skipped_no_email: skippedNoEmail,
      failed: failedEmails
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Szerver hiba történt.' }, { status: 500 })
  }
}