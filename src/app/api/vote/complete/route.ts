import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

type CompleteRequest = {
  personId?: string;
};

export async function POST(request: Request) {
  let payload: CompleteRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const personId = payload.personId?.trim();

  if (!personId) {
    return NextResponse.json({ error: "personId is required." }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("weather_vote_people")
    .update({
      last_activity_at: now,
      invite_status: "completed",
    })
    .eq("id", personId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
