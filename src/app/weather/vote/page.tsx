"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { VoteLanding } from "@/components/weather-vote/VoteLanding";

function WeatherVoteContent() {
  const searchParams = useSearchParams();
  const token =
    searchParams.get("token") ?? searchParams.get("t") ?? "";

  return <VoteLanding token={token} />;
}

export default function WeatherVotePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <WeatherVoteContent />
    </Suspense>
  );
}
