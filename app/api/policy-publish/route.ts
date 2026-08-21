import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { title, sections } = body

    if (!title || !sections || !Array.isArray(sections) || sections.length === 0) {
      return NextResponse.json({ error: 'Érvénytelen cím vagy hiányzó szakaszok.' }, { status: 400 })
    }

    const { data: latestPolicy } = await supabaseAdmin
      .from('policies')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const newVersion = (latestPolicy?.version || 0) + 1

    await supabaseAdmin
      .from('policies')
      .update({ is_current: false })
      .eq('is_current', true)

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('policies')
      .insert({
        title,
        sections,
        version: newVersion,
        is_current: true,
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, version: newVersion, policy: inserted })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Szerveroldali hiba történt.' }, { status: 500 })
  }
}