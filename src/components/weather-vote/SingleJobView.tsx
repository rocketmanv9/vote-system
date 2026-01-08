"use client";

import { useState } from "react";
import type { WeatherVoteItem } from "@/lib/weather-vote";
import { WeatherCard } from "@/components/weather-vote/WeatherCard";
import { triggerHaptic } from "@/lib/haptics";
import { celebrate } from "@/lib/celebration";
import "@/styles/weather-vote.css";

type SingleJobViewProps = {
  item: WeatherVoteItem;
  currentIndex: number;
  totalJobs: number;
  isWeatherExpanded: boolean;
  isWeatherLoading: boolean;
  weatherData: any | null;
  onToggleWeather: () => void;
  onVote: (value: string, reason: string) => void;
  submitting: boolean;
  jobStartTime?: Date | null;
  jobEndTime?: Date | null;
};

const voteOptions = [
  { label: "Dispatch anyway", value: "Dispatch anyway", className: "vote-action-btn-go", icon: "✓" },
  { label: "Cancel", value: "Cancel", className: "vote-action-btn-hold", icon: "✕" },
  { label: "Delay by some time", value: "Delay by some time", className: "vote-action-btn-delay", icon: "⏱" },
  { label: "Decide at dispatch", value: "Decide at dispatch", className: "vote-action-btn-go", icon: "?" },
];

export function SingleJobView({
  item,
  currentIndex,
  totalJobs,
  isWeatherExpanded,
  isWeatherLoading,
  weatherData,
  onToggleWeather,
  onVote,
  submitting,
  jobStartTime,
  jobEndTime,
}: SingleJobViewProps) {
  const [reason, setReason] = useState("");
  const [selectedVote, setSelectedVote] = useState<string | null>(null);
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

  const handleVoteClick = (value: string) => {
    triggerHaptic('medium');
    setSelectedVote(value);
    setLocalError(null);
  };

  const handleSubmit = () => {
    if (!selectedVote) {
      setLocalError("Please select a voting option.");
      triggerHaptic('warning');
      return;
    }
    if (!reason.trim()) {
      setLocalError("Please add a reason before submitting.");
      triggerHaptic('warning');
      return;
    }

    setLocalError(null);
    triggerHaptic('success');
    celebrate('success', undefined, 30);
    onVote(selectedVote, reason);
  };

  return (
    <div className="single-job-view">
      {/* Progress Bar */}
      <div className="job-progress-bar">
        <div className="job-progress-fill" style={{ width: `${((currentIndex + 1) / totalJobs) * 100}%` }} />
      </div>

      {/* Progress Text */}
      <div className="job-progress-text">
        Job {currentIndex + 1} of {totalJobs}
      </div>

      {/* Main Job Card */}
      <div className="single-job-card">
        {/* Header */}
        <div className="single-job-header">
          <div>
            <h1 className="single-job-title">{item.property_name || "Property"}</h1>
            <p className="single-job-service">{item.service_name || "Service"}</p>
          </div>
          <span className={riskBadgeClass}>
            {item.risk_level || "Risk N/A"}
          </span>
        </div>

        {/* Job Details */}
        <div className="single-job-details">
          <div className="job-detail-item">
            <span className="job-detail-label">Job ID</span>
            <span className="job-detail-value">{item.internal_job_id}</span>
          </div>
          <div className="job-detail-item">
            <span className="job-detail-label">Date</span>
            <span className="job-detail-value">{item.forecast_date || "TBD"}</span>
          </div>
          <div className="job-detail-item">
            <span className="job-detail-label">Route Time</span>
            <span className="job-detail-value">
              {item.route_start_time || "TBD"} - {item.route_end_time || "TBD"}
            </span>
          </div>
        </div>

        {/* Weather Stats */}
        <div className="single-job-weather-stats">
          <div className="weather-stat-item">
            <span className="weather-stat-icon">☔</span>
            <div>
              <div className="weather-stat-label">Rain Chance</div>
              <div className="weather-stat-value">{item.max_rain_chance ?? "N/A"}%</div>
            </div>
          </div>
          <div className="weather-stat-item">
            <span className="weather-stat-icon">🌧️</span>
            <div>
              <div className="weather-stat-label">Rain Amount</div>
              <div className="weather-stat-value">{item.max_rain_inches_route ?? "N/A"}"</div>
            </div>
          </div>
        </div>

        {/* Weather Card */}
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

        {/* Voting Section */}
        <div className="single-job-voting">
          <h3 className="voting-section-title">What's your decision?</h3>

          <div className="voting-options-grid">
            {voteOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleVoteClick(option.value)}
                className={`voting-option-btn ${option.className} ${selectedVote === option.value ? 'selected' : ''}`}
                disabled={submitting}
              >
                <span className="voting-option-icon">{option.icon}</span>
                <span className="voting-option-label">{option.label}</span>
              </button>
            ))}
          </div>

          {/* Reason Input */}
          <div className="voting-reason-section">
            <label className="voting-reason-label">
              Why did you choose this? <span className="required-indicator">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setLocalError(null);
              }}
              rows={3}
              className="voting-reason-input"
              placeholder="Explain your decision..."
              disabled={submitting}
            />
          </div>

          {/* Error Message */}
          {localError && (
            <div className="voting-error-message">
              {localError}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedVote || !reason.trim()}
            className="voting-submit-btn"
          >
            {submitting ? (
              <>
                <span className="submit-spinner">⟳</span>
                Submitting...
              </>
            ) : (
              <>
                Submit & Continue
                <span className="submit-arrow">→</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
