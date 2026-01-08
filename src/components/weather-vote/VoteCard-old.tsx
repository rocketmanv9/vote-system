"use client";

import { useState } from "react";

import type { WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import { WeatherCard } from "@/components/weather-vote/WeatherCard";

type VoteCardProps = {
  item: WeatherVoteItem;
  vote: WeatherVoteVote | null;
  reason: string;
  onReasonChange: (next: string) => void;
  onVote: (value: string, reason: string) => void;
  submitting: boolean;
  error?: string | null;
  isWeatherExpanded: boolean;
  isWeatherLoading: boolean;
  weatherData: any | null;
  onToggleWeather: () => void;
  jobStartTime?: Date | null;
  jobEndTime?: Date | null;
};

const voteOptions = [
  { label: "Dispatch anyway", value: "Dispatch anyway" },
  { label: "Cancel", value: "Cancel" },
  { label: "Delay by some time", value: "Delay by some time" },
  { label: "Decide at dispatch", value: "Decide at dispatch" },
];

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function VoteCard({
  item,
  vote,
  reason,
  onReasonChange,
  onVote,
  submitting,
  error,
  isWeatherExpanded,
  isWeatherLoading,
  weatherData,
  onToggleWeather,
  jobStartTime,
  jobEndTime,
}: VoteCardProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const riskLabel = item.risk_level?.toLowerCase() ?? "";
  const riskStyle =
    riskLabel.includes("high") || riskLabel.includes("red")
      ? "bg-red-100 text-red-700 border-red-200"
      : riskLabel.includes("medium") || riskLabel.includes("yellow")
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-slate-100 text-slate-600 border-slate-200";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Property</p>
          <h2 className="text-lg font-semibold text-slate-900">
            {item.property_name || "Property"}
          </h2>
          <p className="text-sm text-slate-600">
            {item.service_name || "Service"}
          </p>
          <p className="text-xs text-slate-500">
            Job {item.internal_job_id} - {item.forecast_date || "Date TBD"}
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
          <p>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${riskStyle}`}>
              {item.risk_level || "Risk N/A"}
            </span>
          </p>
          <p className="mt-2">Route: {item.route_start_time || "TBD"} - {item.route_end_time || "TBD"}</p>
          <p>Rain: {item.max_rain_chance ?? "N/A"}% / {item.max_rain_inches_route ?? "N/A"}"</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <p>
          {vote?.vote_value
            ? `Voted: ${vote.vote_value.toUpperCase()}`
            : "Not voted yet"}
        </p>
        {vote?.voted_at && (
          <p>Updated at {formatDateTime(vote.voted_at)}</p>
        )}
      </div>
      {vote?.vote_reason && (
        <p className="mt-2 text-xs text-slate-500">
          Reason: {vote.vote_reason}
        </p>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {voteOptions.map((option) => {
          const selected = vote?.vote_value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => {
                if (!reason.trim()) {
                  setLocalError("Please add a reason before submitting.");
                  return;
                }
                setLocalError(null);
                onVote(option.value, reason);
              }}
              disabled={submitting}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold uppercase transition ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
              } disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase text-slate-500">
          Reason (optional)
        </label>
        <textarea
          value={reason}
          onChange={(event) => {
            setLocalError(null);
            onReasonChange(event.target.value);
          }}
          rows={2}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          placeholder="Add a short reason..."
          disabled={submitting}
        />
        <p className="mt-1 text-[11px] text-slate-500">
          Reason is required to submit a vote.
        </p>
      </div>

      <WeatherCard
        jobId={item.internal_job_id}
        jobAddress={item.property_name ?? null}
        showWeather
        isExpanded={isWeatherExpanded}
        isLoading={isWeatherLoading}
        weatherData={weatherData}
        onToggle={onToggleWeather}
        jobStartTime={jobStartTime}
        jobEndTime={jobEndTime}
      />

      {(localError || error) && (
        <p className="mt-3 text-xs text-red-600">
          {localError || error}
        </p>
      )}
    </div>
  );
}
