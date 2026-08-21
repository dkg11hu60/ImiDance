import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface TestItem {
  id: string;
  table: "profiles" | "events";
}

export async function POST(req: Request) {
  try {
    const { items } = await req.json();

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "No items selected for deletion." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        {
          error: "Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.",
        },
        { status: 500 },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const errors: string[] = [];

    for (const item of items as TestItem[]) {
      const { id, table } = item;

      if (table === "profiles") {
        // Explicitly clean up dependent records in exact schema tables prior to user deletion
        await admin.from("attendances").delete().eq("user_id", id);
        await admin.from("policy_acceptances").delete().eq("user_id", id);
        await admin.from("activity_logs").delete().eq("user_id", id);
        await admin.from("object_roles").delete().eq("user_id", id);

        // Delete user from auth schema (cascades to profiles)
        const { error: authErr } = await admin.auth.admin.deleteUser(id);
        if (authErr) {
          const { error: profErr } = await admin
            .from("profiles")
            .delete()
            .eq("id", id);
          if (profErr) {
            errors.push(
              `Failed to delete profile (${id}): Auth error: ${authErr.message} | Table error: ${profErr.message}`,
            );
          }
        }
      } else if (table === "events") {
        // Clean up attendance entries for this event before removing the event
        await admin.from("attendances").delete().eq("event_id", id);
        const { error: dbErr } = await admin
          .from("events")
          .delete()
          .eq("id", id);
        if (dbErr) {
          errors.push(`Failed to delete event (${id}): ${dbErr.message}`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" | ") }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server error occurred.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
