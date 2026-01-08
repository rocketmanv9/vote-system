import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

type HourlyEntry = {
  time: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  rainChance: number;
  rainInches: number;
  windSpeedMph: number;
};

type WeatherRpcRow = {
  daily_high_temp_f: number | null;
  daily_low_temp_f: number | null;
  worst_hour: { time: string; condition: string } | null;
  hourly_weather: unknown;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get("campaignId")?.trim();
  const internalJobIdRaw = searchParams.get("internalJobId")?.trim();

  if (!campaignId || !internalJobIdRaw) {
    return NextResponse.json(
      { message: "campaignId and internalJobId are required." },
      { status: 400 }
    );
  }

  const internalJobId = Number(internalJobIdRaw);
  if (Number.isNaN(internalJobId)) {
    return NextResponse.json(
      { message: "internalJobId must be a number." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("weather_vote_campaigns")
    .select("campaign_date")
    .eq("id", campaignId)
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json(
      { message: campaignError?.message || "Campaign not found." },
      { status: 404 }
    );
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "get_job_hourly_weather",
    {
      p_job_id: internalJobId,
      p_forecast_date: campaign.campaign_date,
    }
  );

  if (rpcError) {
    return NextResponse.json(
      { message: rpcError.message },
      { status: 500 }
    );
  }

  const weatherObj = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  if (!weatherObj) {
    return NextResponse.json(
      { message: "No hourly weather found" },
      { status: 404 }
    );
  }

  let hourly: HourlyEntry[] = [];
  let dailyHighTempF: number | null = null;
  let dailyLowTempF: number | null = null;
  let worstHour: WeatherRpcRow["worst_hour"] = null;

  try {
    const row = weatherObj as WeatherRpcRow;
    dailyHighTempF = row.daily_high_temp_f ?? null;
    dailyLowTempF = row.daily_low_temp_f ?? null;
    worstHour = row.worst_hour ?? null;

    const rawHourly = row.hourly_weather;
    const parsedHourly =
      typeof rawHourly === "string" ? JSON.parse(rawHourly) : rawHourly;
    if (Array.isArray(parsedHourly)) {
      hourly = parsedHourly
        .map((entry) => ({
          time: String(entry.time ?? ""),
          tempF: Number(entry.tempF ?? 0),
          feelsLikeF: Number(entry.feelsLikeF ?? entry.tempF ?? 0),
          condition: String(entry.condition ?? ""),
          rainChance: Number(entry.rainChance ?? 0),
          rainInches: Number(entry.rainInches ?? 0),
          windSpeedMph: Number(entry.windSpeedMph ?? 0),
        }))
        .filter((entry) => entry.time);
    }
  } catch (error) {
    console.error("Failed to parse hourly_weather", error);
    return NextResponse.json(
      { message: "Failed to parse hourly weather." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    internalJobId,
    forecastDate: campaign.campaign_date,
    provider: "open-meteo",
    timezone: "America/Los_Angeles",
    dailyHighTempF,
    dailyLowTempF,
    worstHour,
    hourly,
  });
}
