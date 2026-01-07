import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

type SubmitRequest = {
  assignmentId?: string;
  vote?: "go" | "delay" | "hold";
  delay_minutes?: number;
  comment?: string;
};

export async function POST(request: Request) {
  let payload: SubmitRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const assignmentId = payload.assignmentId?.trim();
  const vote = payload.vote;
  const delayMinutes = payload.delay_minutes;
  const comment = payload.comment?.trim() || null;

  if (!assignmentId || !vote) {
    return NextResponse.json(
      { error: "assignmentId and vote are required." },
      { status: 400 }
    );
  }

  if (vote === "delay" && (delayMinutes == null || delayMinutes <= 0)) {
    return NextResponse.json(
      { error: "delay_minutes is required for delay votes." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("weather_vote_assignments")
    .update({
      vote,
      delay_minutes: vote === "delay" ? delayMinutes : null,
      comment,
      status: "voted",
      voted_at: now,
      updated_at: now,
    })
    .eq("id", assignmentId)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ assignment: data });
}
