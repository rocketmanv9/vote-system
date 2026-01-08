import { NextResponse } from "next/server";

import { getWeatherVoteContext } from "@/lib/weather-vote";

type ContextRequest = {
  token?: string;
};

export async function POST(request: Request) {
  let payload: ContextRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const token = payload.token?.trim();
  if (!token) {
    return NextResponse.json({ message: "Token is required." }, { status: 400 });
  }

  const { data, error } = await getWeatherVoteContext(token);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 401 });
  }

  const row = data?.[0];
  if (!row) {
    return NextResponse.json(
      { message: "No voting context found for this token." },
      { status: 404 }
    );
  }

  return NextResponse.json({ context: row });
}
