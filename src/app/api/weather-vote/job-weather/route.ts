import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const jobIdRaw = searchParams.get("jobId")?.trim();
  const forecastDate = searchParams.get("forecastDate")?.trim();

  if (!jobIdRaw || !forecastDate) {
    return NextResponse.json(
      { message: "jobId and forecastDate are required." },
      { status: 400 }
    );
  }

  const jobId = Number(jobIdRaw);
  if (Number.isNaN(jobId)) {
    return NextResponse.json(
      { message: "jobId must be a number." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_job_hourly_weather", {
    p_job_id: jobId,
    p_forecast_date: forecastDate,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const weatherObj = Array.isArray(data) && data.length > 0 ? data[0] : data;
  if (!weatherObj) {
    return NextResponse.json(
      { message: "No hourly weather found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ weather: weatherObj });
}
