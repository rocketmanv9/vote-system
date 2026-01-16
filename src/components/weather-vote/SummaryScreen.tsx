"use client";

import { useEffect, useMemo, useState } from "react";
import { confettiBurst } from "@/lib/celebration";
import type { WeatherVoteItem, WeatherVoteJobVote, WeatherVoteVote } from "@/lib/weather-vote";
import "@/styles/weather-vote.css";

type SummaryScreenProps = {
  token: string;
  voterName: string;
  items: WeatherVoteItem[];
  votes: Record<string, WeatherVoteVote | null>;
  onGoBack?: () => void;
};

function getItemKey(item: WeatherVoteItem) {
  return `${item.internal_job_id}|${item.forecast_date ?? ""}|${item.lens_id ?? ""}`;
}

export function SummaryScreen({ token, voterName, items, votes, onGoBack }: SummaryScreenProps) {
  useEffect(() => {
    // Trigger celebration on mount
    confettiBurst(80);
  }, []);

  const votedItems = useMemo(
    () =>
      items.filter((item) => {
        const key = getItemKey(item);
        return votes[key]?.vote_value;
      }),
    [items, votes]
  );

  const [jobVotes, setJobVotes] = useState<Record<string, WeatherVoteJobVote[]>>({});
  const [jobVotesLoading, setJobVotesLoading] = useState<Set<string>>(new Set());
  const [jobVotesErrors, setJobVotesErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;

    const fetchVotes = async (item: WeatherVoteItem) => {
      const key = getItemKey(item);
      if (!item.forecast_date || !item.lens_id) return;
      if (jobVotes[key] || jobVotesLoading.has(key)) return;

      setJobVotesLoading((prev) => new Set(prev).add(key));
      setJobVotesErrors((prev) => ({ ...prev, [key]: "" }));

      try {
        const response = await fetch("/api/weather-vote/job-votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            internalJobId: item.internal_job_id,
            forecastDate: item.forecast_date,
            lensId: item.lens_id,
          }),
        });
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.message || "Unable to load votes.");
        }
        const payload = await response.json();
        setJobVotes((prev) => ({
          ...prev,
          [key]: (payload.votes ?? []) as WeatherVoteJobVote[],
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to load votes.";
        setJobVotesErrors((prev) => ({ ...prev, [key]: message }));
      } finally {
        setJobVotesLoading((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    };

    votedItems.forEach((item) => {
      fetchVotes(item);
    });
  }, [jobVotes, jobVotesLoading, token, votedItems]);

  return (
    <div className="summary-screen">
      {/* Navigation arrows */}
      <div className="screen-navigation">
        {onGoBack && (
          <button
            onClick={onGoBack}
            className="nav-arrow nav-arrow-left"
            aria-label="Go back to welcome"
          >
            ←
          </button>
        )}
        <div className="nav-arrow-placeholder"></div>
      </div>

      <div className="summary-content">
        {/* Disclaimer at the top */}
        <div className="summary-disclaimer-top">
          <div className="disclaimer-icon">⚠️</div>
          <div className="disclaimer-content">
            <div className="disclaimer-title">IMPORTANT NOTICE</div>
            <div className="disclaimer-text">
              Only Tyler and Bob may cancel jobs. This form helps give us context at dispatch to make the correct decisions.
            </div>
          </div>
        </div>

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

                <div className="summary-team-votes">
                  <div className="summary-team-title">Team votes</div>
                  {jobVotesLoading.has(key) && (
                    <div className="summary-team-loading">Loading team votes...</div>
                  )}
                  {!jobVotesLoading.has(key) && jobVotesErrors[key] && (
                    <div className="summary-team-error">{jobVotesErrors[key]}</div>
                  )}
                  {!jobVotesLoading.has(key) &&
                    !jobVotesErrors[key] &&
                    (jobVotes[key]?.length ? (
                      <div className="summary-team-list">
                        {jobVotes[key].map((row, index) => (
                          <div key={`${key}-${index}`} className="summary-team-row">
                            <div className="summary-team-name">{row.voter_label ?? "Voter"}</div>
                            <div className="summary-team-vote">
                              <span className="summary-team-value">{row.vote_value ?? "No vote"}</span>
                              {row.vote_reason ? (
                                <span className="summary-team-reason"> - {row.vote_reason}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="summary-team-empty">No team votes yet.</div>
                    ))}
                </div>

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
