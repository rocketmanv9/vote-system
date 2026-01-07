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
    .select("person_id, display_name, role, campaign_id, revoked_at, expires_at")
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

  return NextResponse.json({
    personId: data.person_id,
    displayName: data.display_name,
    role: data.role,
  });
}
