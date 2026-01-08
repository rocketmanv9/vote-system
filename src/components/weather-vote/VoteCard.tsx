"use client";

import { useState } from "react";
import type { WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import { WeatherCard } from "@/components/weather-vote/WeatherCard";
import { triggerHaptic } from "@/lib/haptics";
import { celebrate } from "@/lib/celebration";
import "@/styles/weather-vote.css";

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
  { label: "Dispatch anyway", value: "Dispatch anyway", className: "vote-action-btn-go" },
  { label: "Cancel", value: "Cancel", className: "vote-action-btn-hold" },
  { label: "Delay by some time", value: "Delay by some time", className: "vote-action-btn-delay" },
  { label: "Decide at dispatch", value: "Decide at dispatch", className: "vote-action-btn-go" },
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

  let riskBadgeClass = "risk-badge";
  if (riskLabel.includes("high") || riskLabel.includes("red")) {
    riskBadgeClass += " risk-badge-red";
  } else if (riskLabel.includes("medium") || riskLabel.includes("yellow")) {
    riskBadgeClass += " risk-badge-yellow";
  } else if (riskLabel.includes("low") || riskLabel.includes("green")) {
    riskBadgeClass += " risk-badge-green";
  }

  const isVoted = !!vote?.vote_value;

  return (
    <div className={`vote-item-card ${isVoted ? 'vote-item-card-voted' : ''}`}>
      <div className="vote-item-header">
        <div className="vote-item-info">
          <h3>{item.property_name || "Property"}</h3>
          <p className="service-name">{item.service_name || "Service"}</p>
          <p className="job-times">
            Job {item.internal_job_id} - {item.forecast_date || "Date TBD"}
          </p>
        </div>
        <div>
          <span className={riskBadgeClass}>
            {item.risk_level || "Risk N/A"}
          </span>
        </div>
      </div>

      <div className="weather-stats">
        <div className="weather-stat">
          Route: {item.route_start_time || "TBD"} - {item.route_end_time || "TBD"}
        </div>
        <div className="weather-stat">
          Rain: {item.max_rain_chance ?? "N/A"}% / {item.max_rain_inches_route ?? "N/A"}"
        </div>
      </div>

      {isVoted && vote.vote_value && (
        <div className="vote-status-badge">
          Voted: {vote.vote_value.toUpperCase()}
          {vote.voted_at && ` at ${formatDateTime(vote.voted_at)}`}
        </div>
      )}
      {vote?.vote_reason && (
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
          Reason: {vote.vote_reason}
        </p>
      )}

      <div className="vote-actions">
        {voteOptions.map((option) => {
          const selected = vote?.vote_value === option.value;
          return (
            <button
              key={option.value}
              onClick={(e) => {
                if (!reason.trim()) {
                  setLocalError("Please add a reason before submitting.");
                  triggerHaptic('warning');
                  return;
                }
                setLocalError(null);
                triggerHaptic('medium');
                celebrate('success', e.currentTarget, 15);
                onVote(option.value, reason);
              }}
              disabled={submitting}
              className={`vote-action-btn ${option.className} ${selected ? 'selected' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="reason-input-container">
        <textarea
          value={reason}
          onChange={(event) => {
            setLocalError(null);
            onReasonChange(event.target.value);
          }}
          rows={2}
          className="reason-input"
          placeholder="Add a reason (required)..."
          disabled={submitting}
        />
        <p style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: '#64748b' }}>
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
        onToggle={() => {
          triggerHaptic('light');
          onToggleWeather();
        }}
        jobStartTime={jobStartTime}
        jobEndTime={jobEndTime}
      />

      {(localError || error) && (
        <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#dc2626' }}>
          {localError || error}
        </p>
      )}
    </div>
  );
}
