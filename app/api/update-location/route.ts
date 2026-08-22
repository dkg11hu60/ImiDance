import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, name, address, maps_url } = body;

    if (!id) {
      return NextResponse.json({ error: "Hiányzó helyszín azonosító." }, { status: 400 });
    }

    const { error, data } = await supabaseAdmin
      .from("locations")
      .update({
        name: name.trim(),
        address: address?.trim() || null,
        maps_url: maps_url?.trim() || null,
      })
      .eq("id", id)
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