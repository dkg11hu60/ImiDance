import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const { members } = await req.json()
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: "Ures vagy hianyzo members lista." }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Szerver konfiguracio hianyzik." }, { status: 500 })
    }
    const admin = createClient(supabaseUrl, serviceKey)

    const redirectTo = new URL(req.url).origin + "/reset-password"
    const results: any[] = []

    for (const m of members) {
      const id = (m?.id || "").toString().trim()
      const email = (m?.email || "").toString().trim().toLowerCase()

      if (!id || !email || email.endsWith("@imisdance.local")) {
        results.push({ id, email, status: "kihagyva (ures vagy placeholder cel-email)" })
        continue
      }

      const { data: userRes, error: getErr } = await admin.auth.admin.getUserById(id)
      if (getErr || !userRes?.user) {
        results.push({ id, email, status: "auth-user nem talalhato" })
        continue
      }
      const currentEmail = (userRes.user.email || "").toLowerCase()

      if (currentEmail.endsWith("@imisdance.local")) {
        const { error: updErr } = await admin.auth.admin.updateUserById(id, { email })
        if (updErr) {
          results.push({ id, email, status: "auth-csere hiba: " + updErr.message })
          continue
        }
      }

      await admin.from("profiles").update({ email }).eq("id", id)

      const { error: resetErr } = await admin.auth.resetPasswordForEmail(email, { redirectTo })
      if (resetErr) {
        results.push({ id, email, status: "email OK, de level-hiba: " + resetErr.message })
        continue
      }

      results.push({ id, email, status: "OK — level kikuldve" })
    }

    return NextResponse.json({ results })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Szerverhiba"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
