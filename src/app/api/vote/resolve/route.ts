import { createHash } from "crypto";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

type ResolveRequest = {
  campaignId?: string;
  token?: string;
};

export async function POST(request: Request) {
  let payload: ResolveRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const campaignId = payload.campaignId?.trim();
  const token = payload.token?.trim();

  if (!campaignId || !token) {
    return NextResponse.json(
      { error: "campaignId and token are required." },
      { status: 400 }
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("weather_vote_tokens")
    .select(
      `
      person_id,
      campaign_id,
      revoked_at,
      expires_at,
      weather_vote_people (
        display_name,
        role
      )
    `
    )
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Token is invalid or expired." },
      { status: 401 }
    );
  }

  if (data.campaign_id !== campaignId) {
    return NextResponse.json(
      { error: "Token does not match campaign." },
      { status: 403 }
    );
  }

  await supabase
    .from("weather_vote_people")
    .update({
      last_activity_at: new Date().toISOString(),
      invite_status: "viewed",
    })
    .eq("id", data.person_id);

  const peopleData = Array.isArray(data.weather_vote_people)
    ? data.weather_vote_people[0]
    : data.weather_vote_people;

  return NextResponse.json({
    personId: data.person_id,
    displayName: peopleData?.display_name ?? null,
    role: peopleData?.role ?? null,
  });
}
