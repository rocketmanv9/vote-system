"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { triggerHaptic } from "@/lib/haptics";
import { celebrate, confettiBurst } from "@/lib/celebration";
import "@/styles/vote-page.css";

type PersonInfo = {
  personId: string;
  displayName: string | null;
  role: string | null;
};

type Assignment = {
  assignmentId: string;
  status: string | null;
  vote: "go" | "delay" | "hold" | null;
  delay_minutes: number | null;
  comment: string | null;
  voted_at?: string | null;
  job: {
    internal_job_id: string | null;
    property_name: string | null;
    service_name: string | null;
    route_start_time: string | null;
    route_end_time: string | null;
    risk_level: string | null;
    violated_rules_text: string | null;
    max_rain_chance: number | null;
    max_rain_inches_route: number | null;
    hourly_weather: unknown;
  };
};

type Vote = "go" | "delay" | "hold";

const delayOptions = [30, 60, 90, 120];

type WeatherEntry = {
  time: string;
  tempF: number;
  feelsLikeF: number;
  condition: string;
  rainChance: number;
  rainInches: number;
  windSpeedMph: number;
};

type WeatherResponse = {
  internalJobId: number;
  forecastDate: string;
  provider: string;
  timezone: string;
  dailyHighTempF: number | null;
  dailyLowTempF: number | null;
  worstHour: { time: string; condition: string } | null;
  hourly: WeatherEntry[];
};

function formatHourLabel(timeValue: string) {
  const parts = timeValue.split("T");
  const timePart = parts[1] ?? timeValue;
  const [hourRaw, minuteRaw] = timePart.split(":");
  const hour = Number(hourRaw);
  if (Number.isNaN(hour)) return timeValue;
  const minute = Number(minuteRaw ?? 0);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  const minutes = minute === 0 ? "" : `:${String(minute).padStart(2, "0")}`;
  return `${hour12}${minutes} ${suffix}`;
}

function parseHourFromTime(timeValue: string | null | undefined) {
  if (!timeValue) return null;
  const asDate = new Date(timeValue);
  if (!Number.isNaN(asDate.getTime())) {
    return asDate.getHours();
  }
  const parts = timeValue.split("T");
  const timePart = parts[1] ?? timeValue;
  const [hourRaw] = timePart.split(":");
  const hour = Number(hourRaw);
  return Number.isNaN(hour) ? null : hour;
}

function computePeak(hourly: WeatherEntry[]) {
  if (!hourly.length) return null;
  const peakInchesEntry = hourly.reduce((max, entry) =>
    entry.rainInches > max.rainInches ? entry : max
  );
  const useInches = peakInchesEntry.rainInches > 0;
  const peakEntry = useInches
    ? peakInchesEntry
    : hourly.reduce((max, entry) =>
        entry.rainChance > max.rainChance ? entry : max
      );
  return {
    time: peakEntry.time,
    rainChance: peakEntry.rainChance,
    rainInches: peakEntry.rainInches,
  };
}

function getTempStyles(tempF: number, condition: string) {
  const isSunny = condition.toLowerCase().includes("sun") || condition.toLowerCase().includes("clear");
  if (tempF <= 33) {
    return { color: "#7c3aed", background: "rgba(233, 213, 255, 0.5)", border: "rgba(124, 58, 237, 0.35)" };
  }
  if (tempF >= 65 && isSunny) {
    return { color: "#16a34a", background: "rgba(187, 247, 208, 0.6)", border: "rgba(22, 163, 74, 0.35)" };
  }
  return { color: "#2563eb", background: "rgba(219, 234, 254, 0.5)", border: "rgba(59, 130, 246, 0.35)" };
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export default function VotePage() {
  const params = useParams<{ campaignId: string }>();
  const searchParams = useSearchParams();
  const campaignId = params.campaignId;
  const token = searchParams.get("t") ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [person, setPerson] = useState<PersonInfo | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [weatherCache, setWeatherCache] = useState<
    Record<string, WeatherResponse | null>
  >({});
  const [weatherErrors, setWeatherErrors] = useState<
    Record<string, string>
  >({});
  const weatherLoadingRef = useRef<Record<string, boolean>>({});
  const [expandedWeather, setExpandedWeather] = useState<
    Record<string, boolean>
  >({});
  const weatherScrollRef = useRef<HTMLDivElement | null>(null);

  const current = assignments[currentIndex];
  const total = assignments.length;
  const canAdvance =
    !!current &&
    !!current.vote &&
    (current.vote !== "delay" || !!current.delay_minutes);

  const progressLabel = useMemo(() => {
    if (!total) return "";
    return `${currentIndex + 1} of ${total}`;
  }, [currentIndex, total]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!campaignId || !token) {
        setError("Missing campaign or token.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resolveResponse = await fetch("/api/vote/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId, token }),
        });

        if (!resolveResponse.ok) {
          const errorPayload = await resolveResponse.json();
          throw new Error(errorPayload.error || "Invalid voting link.");
        }

        const resolveData = (await resolveResponse.json()) as PersonInfo;
        if (cancelled) return;
        setPerson(resolveData);

        const assignmentsResponse = await fetch(
          `/api/vote/assignments?campaignId=${encodeURIComponent(
            campaignId
          )}&personId=${encodeURIComponent(resolveData.personId)}`
        );

        if (!assignmentsResponse.ok) {
          const errorPayload = await assignmentsResponse.json();
          throw new Error(errorPayload.error || "Failed to load assignments.");
        }

        const assignmentsData = await assignmentsResponse.json();
        if (cancelled) return;
        setAssignments(assignmentsData.assignments || []);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unexpected error.";
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [campaignId, token]);

  const submitVote = useCallback(
    async (assignment: Assignment) => {
      const response = await fetch("/api/vote/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: assignment.assignmentId,
          vote: assignment.vote,
          delay_minutes: assignment.delay_minutes ?? undefined,
          comment: assignment.comment ?? undefined,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json();
        throw new Error(errorPayload.error || "Failed to submit vote.");
      }

      const data = await response.json();
      return data.assignment;
    },
    []
  );

  useEffect(() => {
    const internalJobId = current?.job.internal_job_id;
    if (!internalJobId) return;
    const cacheKey = String(internalJobId);
    if (weatherCache[cacheKey] !== undefined) return;
    if (weatherErrors[cacheKey]) return;
    if (weatherLoadingRef.current[cacheKey]) return;

    let cancelled = false;
    weatherLoadingRef.current[cacheKey] = true;

    async function loadWeather() {
      try {
        const response = await fetch(
          `/api/vote/job-weather?campaignId=${encodeURIComponent(
            campaignId
          )}&internalJobId=${encodeURIComponent(cacheKey)}`
        );
        if (!response.ok) {
          if (response.status === 404) {
            if (!cancelled) {
              setWeatherCache((prev) => ({ ...prev, [cacheKey]: null }));
            }
            return;
          }
          const payload = await response.json();
          throw new Error(payload.message || "Weather lookup failed.");
        }
        const payload = (await response.json()) as WeatherResponse;
        if (!cancelled) {
          setWeatherCache((prev) => ({ ...prev, [cacheKey]: payload }));
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Weather lookup failed.";
        setWeatherErrors((prev) => ({ ...prev, [cacheKey]: message }));
      } finally {
        weatherLoadingRef.current[cacheKey] = false;
      }
    }

    loadWeather();

    return () => {
      cancelled = true;
    };
  }, [
    campaignId,
    current?.job.internal_job_id,
    weatherCache,
    weatherErrors,
  ]);

  const updateAssignment = useCallback(
    (assignmentId: string, partial: Partial<Assignment>) => {
      setAssignments((prev) =>
        prev.map((assignment) =>
          assignment.assignmentId === assignmentId
            ? { ...assignment, ...partial }
            : assignment
        )
      );
    },
    []
  );

  const toggleWeather = useCallback((assignmentId: string) => {
    triggerHaptic('light');
    setExpandedWeather((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  }, []);

  const finishVoting = useCallback(async () => {
    if (!person?.personId) return;
    try {
      await fetch("/api/vote/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.personId }),
      });
    } catch {
      // Best effort; completion is not blocking for the UI.
    }
  }, [person?.personId]);

  const submitAllVotes = useCallback(async () => {
    setSaving(true);
    setSaveError(null);

    try {
      const updates = new Map<string, Assignment>();
      for (const assignment of assignments) {
        if (!assignment.vote) {
          throw new Error("Please select a vote for every job.");
        }
        if (assignment.vote === "delay" && !assignment.delay_minutes) {
          throw new Error("Please select delay minutes for every delay vote.");
        }
        const updated = await submitVote(assignment);
        updates.set(assignment.assignmentId, {
          ...assignment,
          vote: updated.vote ?? assignment.vote,
          delay_minutes:
            updated.delay_minutes ?? assignment.delay_minutes ?? null,
          comment: updated.comment ?? assignment.comment ?? null,
          status: updated.status ?? assignment.status,
          voted_at: updated.voted_at ?? assignment.voted_at ?? null,
        });
      }

      setAssignments((prev) =>
        prev.map((assignment) => updates.get(assignment.assignmentId) ?? assignment)
      );

      await finishVoting();
      triggerHaptic('success');
      confettiBurst(60);
      setCurrentIndex(assignments.length);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit votes.";
      setSaveError(message);
      triggerHaptic('error');
    } finally {
      setSaving(false);
    }
  }, [assignments, finishVoting, submitVote]);

  const goPrev = useCallback(() => {
    triggerHaptic('light');
    setCurrentIndex((index) => Math.max(0, index - 1));
  }, []);

  const goNext = useCallback(() => {
    if (saving) return;
    if (!canAdvance) return;
    if (currentIndex + 1 >= assignments.length) {
      if (allComplete) {
        submitAllVotes();
      }
      return;
    }
    triggerHaptic('medium');
    celebrate('success', undefined, 20);
    setCurrentIndex((index) => Math.min(assignments.length, index + 1));
  }, [allComplete, assignments.length, canAdvance, currentIndex, saving, submitAllVotes]);

  const currentWeather = current?.job.internal_job_id
    ? weatherCache[String(current.job.internal_job_id)]
    : undefined;
  const currentWeatherError = current?.job.internal_job_id
    ? weatherErrors[String(current.job.internal_job_id)]
    : null;
  const peak = currentWeather?.hourly
    ? computePeak(currentWeather.hourly)
    : null;
  const worstHour = currentWeather?.worstHour ?? null;
  const jobStartHour = parseHourFromTime(current?.job.route_start_time);
  const jobEndHour = parseHourFromTime(current?.job.route_end_time);
  const isExpanded = current?.assignmentId
    ? expandedWeather[current.assignmentId]
    : false;
  const allComplete = assignments.every(
    (assignment) =>
      !!assignment.vote &&
      (assignment.vote !== "delay" || !!assignment.delay_minutes)
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        goPrev();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev]);

  useEffect(() => {
    if (!isExpanded || !currentWeather?.hourly?.length) return;
    if (!weatherScrollRef.current || jobStartHour == null) return;
    const container = weatherScrollRef.current;
    const target = container.querySelector(
      `[data-hour="${jobStartHour}"]`
    ) as HTMLElement | null;
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }, 100);
    }
  }, [isExpanded, currentWeather?.hourly, jobStartHour]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="state-card">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="state-card">
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', color: '#0f172a' }}>
            Link issue
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>{error}</p>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            Please request a new voting link from your coordinator.
          </p>
        </div>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="empty-container">
        <div className="state-card">
          No assignments found for this campaign.
        </div>
      </div>
    );
  }

  if (currentIndex >= assignments.length) {
    return (
      <div className="completion-container">
        <div className="completion-card">
          <h1>
            Thanks{person?.displayName ? `, ${person.displayName}` : ""}!
          </h1>
          <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#166534' }}>
            Your votes have been saved. Here is a quick summary.
          </p>
          <div className="summary-list">
            {assignments.map((assignment) => (
              <div
                key={assignment.assignmentId}
                className="summary-card"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#0f172a' }}>
                      {assignment.job.property_name || "Job"}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {assignment.job.service_name || "Service"}
                    </p>
                  </div>
                  <span style={{
                    borderRadius: '9999px',
                    background: '#f1f5f9',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color: '#475569'
                  }}>
                    {assignment.vote ?? "pending"}
                  </span>
                </div>
                {assignment.vote === "delay" && assignment.delay_minutes && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                    Delay: {assignment.delay_minutes} minutes
                  </p>
                )}
                {assignment.comment && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                    Comment: {assignment.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
            <button
              onClick={() => {
                triggerHaptic('light');
                finishVoting();
              }}
              className="nav-btn nav-btn-primary"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vote-page-container">
      <div className="vote-page-content">
        <div className="vote-header">
          <div className="vote-header-info">
            <p className="vote-header-label">Voting portal</p>
            <h1 className="vote-header-title">
              {person?.displayName || "Voter"}
            </h1>
          </div>
          <div className="vote-progress-badge">
            {progressLabel}
          </div>
        </div>

        <div className="vote-card">
          <div className="vote-card-header">
            <div className="vote-card-info">
              <p className="property-label">Property</p>
              <h2>{current?.job.property_name || "Job"}</h2>
              <p className="service-info">
                {current?.job.service_name || "Service"} -{" "}
                {current?.job.route_start_time || "TBD"} -{" "}
                {current?.job.route_end_time || "TBD"}
              </p>
            </div>
            <div className="vote-risk-panel">
              <p>Risk: {current?.job.risk_level || "N/A"}</p>
              <p>Rain chance: {current?.job.max_rain_chance ?? "N/A"}</p>
              <p>Rain inches: {current?.job.max_rain_inches_route ?? "N/A"}</p>
            </div>
          </div>

          {current?.job.violated_rules_text && (
            <div className="alert-warning">
              {current.job.violated_rules_text}
            </div>
          )}

          <div className="weather-section">
            <div className="weather-header">
              <div>
                <h3>Weather Forecast</h3>
                <p className="forecast-date">
                  {currentWeather?.forecastDate ?? "Forecast date"}
                </p>
              </div>
              <button
                onClick={() => current && toggleWeather(current.assignmentId)}
                className="weather-expand-btn"
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            </div>

            {currentWeatherError && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#dc2626' }}>
                Unable to load hourly weather.
              </p>
            )}
            {currentWeather === null && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                Hourly weather not available.
              </p>
            )}
            {!currentWeather && !currentWeatherError && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#94a3b8' }}>Loading weather...</p>
            )}

            {currentWeather && (
              <>
                <div className="weather-temps">
                  <div className="temp-card-high">
                    <p className="temp-label">High</p>
                    <p className="temp-value">
                      {currentWeather.dailyHighTempF != null
                        ? Math.round(currentWeather.dailyHighTempF)
                        : "--"}
                      F
                    </p>
                  </div>
                  <div className="temp-card-low">
                    <p className="temp-label">Low</p>
                    <p className="temp-value">
                      {currentWeather.dailyLowTempF != null
                        ? Math.round(currentWeather.dailyLowTempF)
                        : "--"}
                      F
                    </p>
                  </div>
                </div>

                {worstHour && !isExpanded && (
                  <div className="alert-warning" style={{ marginTop: '0.75rem' }}>
                    <p style={{ fontWeight: 600 }}>Worst conditions</p>
                    <p style={{ marginTop: '0.25rem' }}>
                      {formatHourLabel(worstHour.time)} - {worstHour.condition}
                    </p>
                  </div>
                )}

                {peak && !isExpanded && (
                  <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#78350f' }}>
                    Peak: {peak.rainInches.toFixed(3)}" @ {peak.rainChance}% (
                    {formatHourLabel(peak.time)})
                  </p>
                )}

                {isExpanded && (
                  <div
                    ref={weatherScrollRef}
                    className="hourly-weather-scroll"
                  >
                    {currentWeather.hourly.map((entry, idx) => {
                      const currentHour = parseHourFromTime(entry.time);
                      const isWithinJobTime =
                        currentHour != null &&
                        jobStartHour != null &&
                        jobEndHour != null &&
                        currentHour >= jobStartHour &&
                        currentHour <= jobEndHour;
                      const isJobStart = currentHour === jobStartHour;
                      const isJobEnd = currentHour === jobEndHour;
                      const tempStyles = getTempStyles(entry.tempF, entry.condition);

                      return (
                        <div
                          key={`${entry.time}-${idx}`}
                          data-hour={currentHour ?? undefined}
                          className="hourly-weather-card"
                          style={{
                            borderColor: isWithinJobTime ? "#f59e0b" : tempStyles.border,
                            background: isWithinJobTime ? "rgba(251, 191, 36, 0.15)" : tempStyles.background,
                          }}
                        >
                          {isJobStart && (
                            <span style={{
                              marginBottom: '0.25rem',
                              display: 'inline-flex',
                              borderRadius: '9999px',
                              background: '#f59e0b',
                              padding: '0.125rem 0.5rem',
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              color: 'white'
                            }}>
                              Job start
                            </span>
                          )}
                          <p style={{ fontWeight: 600, color: '#0f172a' }}>
                            {formatHourLabel(entry.time)}
                          </p>
                          <p style={{ color: tempStyles.color }}>
                            {Math.round(entry.tempF)}F
                          </p>
                          {Math.round(entry.feelsLikeF) !== Math.round(entry.tempF) && (
                            <p style={{ fontSize: '0.625rem', color: '#64748b' }}>
                              feels {Math.round(entry.feelsLikeF)}F
                            </p>
                          )}
                          <p style={{ fontSize: '0.625rem', color: '#64748b' }}>
                            {entry.condition}
                          </p>
                          {entry.rainChance > 0 && (
                            <p style={{ fontSize: '0.625rem', color: '#475569' }}>
                              Rain {Math.round(entry.rainChance)}%
                            </p>
                          )}
                          {entry.rainInches > 0 && (
                            <p style={{ fontSize: '0.625rem', color: '#475569' }}>
                              {entry.rainInches.toFixed(2)}" rain
                            </p>
                          )}
                          {entry.windSpeedMph > 5 && (
                            <p style={{ fontSize: '0.625rem', color: '#475569' }}>
                              Wind {Math.round(entry.windSpeedMph)} mph
                            </p>
                          )}
                          {isJobEnd && (
                            <span style={{
                              marginTop: '0.25rem',
                              display: 'inline-flex',
                              borderRadius: '9999px',
                              background: '#1e293b',
                              padding: '0.125rem 0.5rem',
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              color: 'white'
                            }}>
                              Job end
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="vote-buttons">
            {(["go", "delay", "hold"] as Vote[]).map((vote) => (
              <button
                key={vote}
                onClick={() => {
                  triggerHaptic('medium');
                  const defaultDelay =
                    vote === "delay"
                      ? current.delay_minutes ?? 60
                      : null;
                  updateAssignment(current.assignmentId, {
                    vote,
                    delay_minutes: defaultDelay,
                  });
                }}
                className={`vote-btn ${current.vote === vote ? 'vote-btn-selected' : ''}`}
              >
                {vote}
              </button>
            ))}
          </div>

          {current.vote === "delay" && (
            <div className="delay-panel">
              <h4>Select delay minutes</h4>
              <div className="delay-options">
                {delayOptions.map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => {
                      triggerHaptic('selection');
                      updateAssignment(current.assignmentId, {
                        delay_minutes: minutes,
                      });
                    }}
                    className={`delay-btn ${current.delay_minutes === minutes ? 'delay-btn-selected' : ''}`}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min={1}
                  placeholder="Custom"
                  value={current.delay_minutes ?? ""}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    updateAssignment(current.assignmentId, {
                      delay_minutes: Number.isNaN(value) ? null : value,
                    });
                  }}
                  className="delay-custom-input"
                />
              </div>
            </div>
          )}

          <div className="comment-section">
            <label>Optional comment</label>
            <textarea
              value={current.comment ?? ""}
              onChange={(event) => {
                updateAssignment(current.assignmentId, {
                  comment: event.target.value,
                });
              }}
              rows={3}
              className="comment-textarea"
              placeholder="Add any context for your vote..."
            />
          </div>

          {saveError && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#dc2626' }}>{saveError}</p>
          )}
          {saving && (
            <p style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>Submitting votes...</p>
          )}
        </div>

        <div className="vote-navigation">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="nav-btn"
          >
            Back
          </button>
          <button
            onClick={goNext}
            disabled={!canAdvance || (currentIndex + 1 >= assignments.length && !allComplete) || saving}
            className="nav-btn nav-btn-primary"
          >
            {currentIndex + 1 >= assignments.length
              ? saving
                ? "Submitting..."
                : "Finish"
              : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
