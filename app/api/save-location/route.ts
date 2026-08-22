import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { error, data } = await supabaseAdmin
      .from("locations")
      .insert([body])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, location: data?.[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ismeretlen hiba";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}