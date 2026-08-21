import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

interface MemberInput {
  id?: string
  email?: string
}

const isValidEmail = (email?: string | null): boolean => {
  if (!email) return false
  const e = email.trim().toLowerCase()
  return e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}

export async function POST(req: Request) {
  try {
    const { members } = await req.json()
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'Missing or empty members array.' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration missing.' }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const redirectTo = `${new URL(req.url).origin}/reset-password`
    const results: Array<{ id: string; email: string; status: string }> = []

    for (const m of (members as MemberInput[])) {
      const id = (m?.id || '').toString().trim()
      const email = (m?.email || '').toString().trim().toLowerCase()

      if (!id || !isValidEmail(email)) {
        results.push({ id, email, status: 'skipped (invalid email or missing ID)' })
        continue
      }

      const { data: userRes, error: getErr } = await admin.auth.admin.getUserById(id)
      if (getErr || !userRes?.user) {
        results.push({ id, email, status: 'auth user not found' })
        continue
      }

      const currentEmail = (userRes.user.email || '').toLowerCase()

      if (currentEmail !== email) {
        const { error: updErr } = await admin.auth.admin.updateUserById(id, {
          email,
          email_confirm: true,
        })
        if (updErr) {
          results.push({ id, email, status: 'auth update error: ' + updErr.message })
          continue
        }
      }

      const { error: profileErr } = await admin
        .from('profiles')
        .update({ email })
        .eq('id', id)

      if (profileErr) {
        results.push({ id, email, status: 'profile db update error: ' + profileErr.message })
        continue
      }

      const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
      if (resetErr) {
        results.push({ id, email, status: 'email updated, reset email failed: ' + resetErr.message })
        continue
      }

      results.push({ id, email, status: 'OK — reset email sent' })
    }

    return NextResponse.json({ results })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}