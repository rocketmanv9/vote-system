"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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
      setCurrentIndex(assignments.length);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit votes.";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }, [assignments, finishVoting, submitVote]);

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
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Link issue
          </h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-sm text-slate-500">
            Please request a new voting link from your coordinator.
          </p>
        </div>
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
          No assignments found for this campaign.
        </div>
      </div>
    );
  }

  if (currentIndex >= assignments.length) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-16">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Thanks{person?.displayName ? `, ${person.displayName}` : ""}!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Your votes have been saved. Here is a quick summary.
          </p>
          <div className="mt-6 space-y-4">
            {assignments.map((assignment) => (
              <div
                key={assignment.assignmentId}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {assignment.job.property_name || "Job"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {assignment.job.service_name || "Service"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                    {assignment.vote ?? "pending"}
                  </span>
                </div>
                {assignment.vote === "delay" && assignment.delay_minutes && (
                  <p className="mt-2 text-xs text-slate-500">
                    Delay: {assignment.delay_minutes} minutes
                  </p>
                )}
                {assignment.comment && (
                  <p className="mt-2 text-xs text-slate-600">
                    Comment: {assignment.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 text-right">
            <button
              onClick={finishVoting}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Voting portal</p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {person?.displayName || "Voter"}
            </h1>
          </div>
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
            {progressLabel}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Property
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {current?.job.property_name || "Job"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {current?.job.service_name || "Service"} -{" "}
                {current?.job.route_start_time || "TBD"} -{" "}
                {current?.job.route_end_time || "TBD"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <p>Risk: {current?.job.risk_level || "N/A"}</p>
              <p>Rain chance: {current?.job.max_rain_chance ?? "N/A"}</p>
              <p>Rain inches: {current?.job.max_rain_inches_route ?? "N/A"}</p>
            </div>
          </div>

          {current?.job.violated_rules_text && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {current.job.violated_rules_text}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Weather Forecast
                </p>
                <p className="text-xs text-slate-500">
                  {currentWeather?.forecastDate ?? "Forecast date"}
                </p>
              </div>
              <button
                onClick={() => current && toggleWeather(current.assignmentId)}
                className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold uppercase text-orange-700"
              >
                {isExpanded ? "Collapse" : "Expand"}
              </button>
            </div>

            {currentWeatherError && (
              <p className="mt-2 text-xs text-red-600">
                Unable to load hourly weather.
              </p>
            )}
            {currentWeather === null && (
              <p className="mt-2 text-xs text-slate-500">
                Hourly weather not available.
              </p>
            )}
            {!currentWeather && !currentWeatherError && (
              <p className="mt-2 text-xs text-slate-400">Loading weather...</p>
            )}

            {currentWeather && (
              <>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-gradient-to-r from-red-500 to-red-400 px-4 py-3 text-white">
                    <p className="text-xs uppercase tracking-wide text-red-100">
                      High
                    </p>
                    <p className="text-2xl font-semibold">
                      {currentWeather.dailyHighTempF != null
                        ? Math.round(currentWeather.dailyHighTempF)
                        : "--"}
                      F
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 px-4 py-3 text-white">
                    <p className="text-xs uppercase tracking-wide text-blue-100">
                      Low
                    </p>
                    <p className="text-2xl font-semibold">
                      {currentWeather.dailyLowTempF != null
                        ? Math.round(currentWeather.dailyLowTempF)
                        : "--"}
                      F
                    </p>
                  </div>
                </div>

                {worstHour && !isExpanded && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
                    <p className="font-semibold">Worst conditions</p>
                    <p className="mt-1">
                      {formatHourLabel(worstHour.time)} - {worstHour.condition}
                    </p>
                  </div>
                )}

                {peak && !isExpanded && (
                  <p className="mt-3 text-xs text-slate-600">
                    Peak: {peak.rainInches.toFixed(3)}" @ {peak.rainChance}% (
                    {formatHourLabel(peak.time)})
                  </p>
                )}

                {isExpanded && (
                  <div
                    ref={weatherScrollRef}
                    className="mt-4 flex gap-2 overflow-x-auto pb-2"
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
                          className={`min-w-[110px] rounded-xl border px-3 py-2 text-xs shadow-sm ${
                            isWithinJobTime
                              ? "border-amber-400 bg-amber-50"
                              : "border-slate-200 bg-white"
                          }`}
                          style={{
                            borderColor: isWithinJobTime ? "#f59e0b" : tempStyles.border,
                            background: isWithinJobTime ? "rgba(251, 191, 36, 0.15)" : tempStyles.background,
                          }}
                        >
                          {isJobStart && (
                            <span className="mb-1 inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                              Job start
                            </span>
                          )}
                          <p className="font-semibold text-slate-900">
                            {formatHourLabel(entry.time)}
                          </p>
                          <p style={{ color: tempStyles.color }}>
                            {Math.round(entry.tempF)}F
                          </p>
                          {Math.round(entry.feelsLikeF) !== Math.round(entry.tempF) && (
                            <p className="text-[10px] text-slate-500">
                              feels {Math.round(entry.feelsLikeF)}F
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            {entry.condition}
                          </p>
                          {entry.rainChance > 0 && (
                            <p className="text-[10px] text-slate-600">
                              Rain {Math.round(entry.rainChance)}%
                            </p>
                          )}
                          {entry.rainInches > 0 && (
                            <p className="text-[10px] text-slate-600">
                              {entry.rainInches.toFixed(2)}" rain
                            </p>
                          )}
                          {entry.windSpeedMph > 5 && (
                            <p className="text-[10px] text-slate-600">
                              Wind {Math.round(entry.windSpeedMph)} mph
                            </p>
                          )}
                          {isJobEnd && (
                            <span className="mt-1 inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
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

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(["go", "delay", "hold"] as Vote[]).map((vote) => (
              <button
                key={vote}
                onClick={() => {
                  const defaultDelay =
                    vote === "delay"
                      ? current.delay_minutes ?? 60
                      : null;
                  updateAssignment(current.assignmentId, {
                    vote,
                    delay_minutes: defaultDelay,
                  });
                }}
                className={`rounded-xl border px-4 py-3 text-sm font-semibold uppercase transition ${
                  current.vote === vote
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-800 hover:border-slate-400"
                }`}
              >
                {vote}
              </button>
            ))}
          </div>

          {current.vote === "delay" && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">
                Select delay minutes
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {delayOptions.map((minutes) => (
                  <button
                    key={minutes}
                  onClick={() => {
                    updateAssignment(current.assignmentId, {
                      delay_minutes: minutes,
                    });
                  }}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${
                      current.delay_minutes === minutes
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {minutes}m
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
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
                  className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="mt-6">
            <label className="text-sm font-semibold text-slate-800">
              Optional comment
            </label>
            <textarea
              value={current.comment ?? ""}
              onChange={(event) => {
                updateAssignment(current.assignmentId, {
                  comment: event.target.value,
                });
              }}
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm"
              placeholder="Add any context for your vote..."
            />
          </div>

          {saveError && (
            <p className="mt-3 text-sm text-red-600">{saveError}</p>
          )}
          {saving && (
            <p className="mt-3 text-xs text-slate-400">Submitting votes...</p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
            disabled={currentIndex === 0}
            className="rounded-full border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={() => {
              if (currentIndex + 1 >= assignments.length) {
                submitAllVotes();
                return;
              }
              setCurrentIndex((index) =>
                Math.min(assignments.length, index + 1)
              );
            }}
            disabled={!canAdvance || (currentIndex + 1 >= assignments.length && !allComplete) || saving}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
