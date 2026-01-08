import { NextResponse } from "next/server";

import { getWeatherVoteJobVotes } from "@/lib/weather-vote";

type JobVotesRequest = {
  token?: string;
  internalJobId?: number;
  forecastDate?: string | null;
  lensId?: string | null;
};

export async function POST(request: Request) {
  let payload: JobVotesRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const token = payload.token?.trim();
  const internalJobId = payload.internalJobId;
  const forecastDate = payload.forecastDate?.trim();
  const lensId = payload.lensId?.trim();

  if (!token || internalJobId == null || !forecastDate || !lensId) {
    return NextResponse.json(
      { message: "token, internalJobId, forecastDate, and lensId are required." },
      { status: 400 }
    );
  }

  const { data, error } = await getWeatherVoteJobVotes({
    token,
    internalJobId,
    forecastDate,
    lensId,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ votes: data ?? [] });
}
