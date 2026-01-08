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

  if (!["go", "delay", "hold"].includes(vote)) {
    return NextResponse.json({ error: "Invalid vote value." }, { status: 400 });
  }

  if (vote !== "delay" && delayMinutes != null) {
    return NextResponse.json(
      { error: "delay_minutes is only allowed for delay votes." },
      { status: 400 }
    );
  }

  const normalizedDelayMinutes =
    vote === "delay" ? (delayMinutes && delayMinutes > 0 ? delayMinutes : 60) : null;

  const supabase = createSupabaseServerClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("weather_vote_assignments")
    .update({
      vote,
      delay_minutes: normalizedDelayMinutes,
      comment,
      status: "voted",
      voted_at: now,
      updated_at: now,
    })
    .eq("id", assignmentId)
    .select("id, campaign_person_id, vote, delay_minutes, comment, status, voted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabase
    .from("weather_vote_people")
    .update({
      last_activity_at: now,
      invite_status: "started",
    })
    .eq("id", data.campaign_person_id);

  return NextResponse.json({ assignment: data });
}
