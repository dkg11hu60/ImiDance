import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

interface AttendanceRecord {
  profile_id?: string | null
}

interface ProfileRecord {
  id: string
  full_name?: string | null
  email?: string | null
}

const isValidEmail = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const eventId = searchParams.get('eventId')

    if (!eventId) {
      return NextResponse.json({ error: 'Missing required parameter: eventId.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration missing: Supabase admin key.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // Query attendances table using profile_id only
    const { data: eventAtts, error: attsErr } = await supabaseAdmin
      .from('attendances')
      .select('profile_id')
      .eq('event_id', eventId)

    if (attsErr) {
      return NextResponse.json({ error: `Attendance query error: ${attsErr.message}` }, { status: 500 })
    }

    const rawAtts = (eventAtts || []) as AttendanceRecord[]
    const profileIds = Array.from(
      new Set(rawAtts.map((a) => a.profile_id).filter(Boolean) as string[])
    )

    if (profileIds.length === 0) {
      return NextResponse.json({ recipients: [] })
    }

    // Query profiles matching the profile_id array
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', profileIds)

    if (profErr) {
      return NextResponse.json({ error: `Profiles query error: ${profErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ recipients: profiles || [] })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Server error occurred.'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { eventId, subject, body } = await req.json()

    if (!eventId) {
      return NextResponse.json({ error: 'Missing required field: eventId.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration missing: Supabase admin key.' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey)

    // 1. Deactivate event
    const { error: dbError } = await supabaseAdmin
      .from('events')
      .update({ is_active: false })
      .eq('id', eventId)

    if (dbError) {
      return NextResponse.json({ error: `Database update error: ${dbError.message}` }, { status: 500 })
    }

    // 2. Fetch attendee profile IDs
    const { data: eventAtts, error: attsErr } = await supabaseAdmin
      .from('attendances')
      .select('profile_id')
      .eq('event_id', eventId)

    if (attsErr) {
      return NextResponse.json({ error: `Attendance query error: ${attsErr.message}` }, { status: 500 })
    }

    const rawAtts = (eventAtts || []) as AttendanceRecord[]
    const profileIds = Array.from(
      new Set(rawAtts.map((a) => a.profile_id).filter(Boolean) as string[])
    )

    const sentList: Array<{ name: string; email: string }> = []
    const skippedNoEmail: Array<{ name: string }> = []
    const failedEmails: Array<{ name: string; email: string; error: string }> = []

    if (profileIds.length > 0) {
      const { data: profiles, error: profErr } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email')
        .in('id', profileIds)

      if (profErr) {
        return NextResponse.json({ error: `Profiles query error: ${profErr.message}` }, { status: 500 })
      }

      const smtpHost = process.env.SMTP_HOST
      const smtpPort = Number(process.env.SMTP_PORT) || 587
      const smtpUser = process.env.SMTP_USER
      const smtpPass = process.env.SMTP_PASS
      const smtpSecure = process.env.SMTP_SECURE === 'true'

      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json({
          error: 'Missing SMTP configuration (SMTP_HOST, SMTP_USER, SMTP_PASS).'
        }, { status: 500 })
      }

      const fromEmail = process.env.SMTP_FROM || smtpUser

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: { user: smtpUser, pass: smtpPass },
        tls: { rejectUnauthorized: false }
      })

      const profileList = (profiles || []) as ProfileRecord[]

      for (const prof of profileList) {
        const name = prof.full_name || 'Táncos'
        const email = (prof.email || '').trim()

        if (!isValidEmail(email)) {
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
        } catch (sendErr: unknown) {
          const errorMessage = sendErr instanceof Error ? sendErr.message : 'Unknown SMTP error'
          failedEmails.push({ email, name, error: errorMessage })
        }
      }
    }

    return NextResponse.json({
      success: true,
      sent: sentList,
      skipped_no_email: skippedNoEmail,
      failed: failedEmails
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Server error occurred.'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}