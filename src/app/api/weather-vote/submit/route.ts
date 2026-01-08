import { NextResponse } from "next/server";

import { submitWeatherVote } from "@/lib/weather-vote";

type SubmitRequest = {
  token?: string;
  internalJobId?: number;
  forecastDate?: string | null;
  lensId?: string | null;
  voteValue?: string;
  voteReason?: string | null;
};

export async function POST(request: Request) {
  let payload: SubmitRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const token = payload.token?.trim();
  const voteValue = payload.voteValue?.trim();
  const internalJobId = payload.internalJobId;

  if (!token || !voteValue || internalJobId == null) {
    return NextResponse.json(
      { message: "token, internalJobId, and voteValue are required." },
      { status: 400 }
    );
  }

  const { data, error } = await submitWeatherVote({
    token,
    internalJobId,
    forecastDate: payload.forecastDate ?? null,
    lensId: payload.lensId ?? null,
    voteValue,
    voteReason: payload.voteReason ?? null,
  });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }

  return NextResponse.json({ result: data });
}
