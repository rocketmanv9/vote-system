"use client";

import { useParams } from "next/navigation";

import { VoteLanding } from "@/components/weather-vote/VoteLanding";

export default function WeatherVoteTokenPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";

  return <VoteLanding token={token} />;
}
