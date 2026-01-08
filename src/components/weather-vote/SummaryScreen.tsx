"use client";

import { useEffect } from "react";
import { confettiBurst } from "@/lib/celebration";
import type { WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import "@/styles/weather-vote.css";

type SummaryScreenProps = {
  voterName: string;
  items: WeatherVoteItem[];
  votes: Record<string, WeatherVoteVote | null>;
};

function getItemKey(item: WeatherVoteItem) {
  return `${item.internal_job_id}|${item.forecast_date ?? ""}|${item.lens_id ?? ""}`;
}

export function SummaryScreen({ voterName, items, votes }: SummaryScreenProps) {
  useEffect(() => {
    // Trigger celebration on mount
    confettiBurst(80);
  }, []);

  const votedItems = items.filter((item) => {
    const key = getItemKey(item);
    return votes[key]?.vote_value;
  });

  return (
    <div className="summary-screen">
      <div className="summary-content">
        {/* Success Icon */}
        <div className="summary-icon">🎉</div>

        {/* Header */}
        <h1 className="summary-title">All Done, {voterName}!</h1>
        <p className="summary-subtitle">
          Thank you for reviewing all {votedItems.length} job{votedItems.length !== 1 ? 's' : ''}.
        </p>

        {/* Summary Cards */}
        <div className="summary-cards">
          {items.map((item) => {
            const key = getItemKey(item);
            const vote = votes[key];

            if (!vote?.vote_value) return null;

            let voteClass = "summary-vote-badge";
            const voteLower = vote.vote_value.toLowerCase();
            if (voteLower.includes("dispatch")) {
              voteClass += " summary-vote-go";
            } else if (voteLower.includes("cancel")) {
              voteClass += " summary-vote-hold";
            } else if (voteLower.includes("delay")) {
              voteClass += " summary-vote-delay";
            }

            return (
              <div key={key} className="summary-job-card">
                <div className="summary-job-header">
                  <div>
                    <h3 className="summary-job-title">{item.property_name || "Property"}</h3>
                    <p className="summary-job-subtitle">{item.service_name || "Service"}</p>
                  </div>
                  <span className={voteClass}>
                    {vote.vote_value}
                  </span>
                </div>

                {vote.vote_reason && (
                  <div className="summary-job-reason">
                    <span className="summary-reason-label">Reason:</span>
                    <p className="summary-reason-text">{vote.vote_reason}</p>
                  </div>
                )}

                <div className="summary-job-meta">
                  <span>Job {item.internal_job_id}</span>
                  <span>•</span>
                  <span>{item.forecast_date || "Date TBD"}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Message */}
        <div className="summary-footer">
          <p>Your responses have been saved. You can now close this window.</p>
        </div>
      </div>
    </div>
  );
}
