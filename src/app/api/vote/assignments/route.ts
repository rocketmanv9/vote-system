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
      status,
      vote,
      delay_minutes,
      comment,
      voted_at,
      weather_vote_jobs (
        internal_job_id,
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
    .eq("campaign_person_id", personId)
    .order("route_start_time", { foreignTable: "weather_vote_jobs" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const assignments = (data ?? []).map((row) => {
    const jobData = Array.isArray(row.weather_vote_jobs)
      ? row.weather_vote_jobs[0]
      : row.weather_vote_jobs;

    return {
      assignmentId: row.id,
      status: row.status,
      vote: row.vote,
      delay_minutes: row.delay_minutes,
      comment: row.comment,
      voted_at: row.voted_at,
      job: {
        internal_job_id: jobData?.internal_job_id ?? null,
        property_name: jobData?.property_name ?? null,
        service_name: jobData?.service_name ?? null,
        route_start_time: jobData?.route_start_time ?? null,
        route_end_time: jobData?.route_end_time ?? null,
        risk_level: jobData?.risk_level ?? null,
        violated_rules_text: jobData?.violated_rules_text ?? null,
        max_rain_chance: jobData?.max_rain_chance ?? null,
        max_rain_inches_route: jobData?.max_rain_inches_route ?? null,
        hourly_weather: jobData?.hourly_weather ?? null,
      },
    };
  });

  return NextResponse.json({ assignments });
}
