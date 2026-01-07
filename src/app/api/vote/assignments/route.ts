import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId")?.trim();
  const personId = searchParams.get("personId")?.trim();

  if (!campaignId || !personId) {
    return NextResponse.json(
      { error: "campaignId and personId are required." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("weather_vote_assignments")
    .select(
      `
      id,
      internal_job_id,
      status,
      vote,
      delay_minutes,
      comment,
      weather_vote_jobs (
        property_name,
        service_name,
        route_start_time,
        route_end_time,
        risk_level,
        violated_rules_text,
        max_rain_chance,
        max_rain_inches_route,
        hourly_weather
      )
    `
    )
    .eq("campaign_id", campaignId)
    .eq("person_id", personId)
    .order("route_start_time", { foreignTable: "weather_vote_jobs" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assignments = (data ?? []).map((row) => ({
    assignmentId: row.id,
    internal_job_id: row.internal_job_id,
    status: row.status,
    vote: row.vote,
    delay_minutes: row.delay_minutes,
    comment: row.comment,
    property_name: row.weather_vote_jobs?.property_name ?? null,
    service_name: row.weather_vote_jobs?.service_name ?? null,
    route_start_time: row.weather_vote_jobs?.route_start_time ?? null,
    route_end_time: row.weather_vote_jobs?.route_end_time ?? null,
    risk_level: row.weather_vote_jobs?.risk_level ?? null,
    violated_rules_text: row.weather_vote_jobs?.violated_rules_text ?? null,
    max_rain_chance: row.weather_vote_jobs?.max_rain_chance ?? null,
    max_rain_inches_route: row.weather_vote_jobs?.max_rain_inches_route ?? null,
    hourly_weather: row.weather_vote_jobs?.hourly_weather ?? null,
  }));

  return NextResponse.json({ assignments });
}
