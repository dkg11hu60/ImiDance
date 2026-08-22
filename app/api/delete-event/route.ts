import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { eventId } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: "Missing event ID." }, { status: 400 });
    }

    // 1. Delete related dependencies (attendances, activity_logs)
    await supabaseAdmin.from("attendances").delete().eq("event_id", eventId);
    await supabaseAdmin.from("activity_logs").delete().eq("event_id", eventId);

    // 2. Permanent deletion from events table
    const { error, data } = await supabaseAdmin
      .from("events")
      .delete()
      .eq("id", eventId)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}