"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { WeatherVoteContext, WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import { WelcomeScreen } from "@/components/weather-vote/WelcomeScreen";
import { SingleJobView } from "@/components/weather-vote/SingleJobView";
import { SummaryScreen } from "@/components/weather-vote/SummaryScreen";
import { ErrorState } from "@/components/weather-vote/ErrorState";
import "@/styles/weather-vote.css";

type SubmitPayload = {
  token: string;
  internalJobId: number;
  forecastDate: string | null;
  lensId: string | null;
  voteValue: string;
  voteReason?: string | null;
};

type ViewState = 'loading' | 'welcome' | 'voting' | 'summary' | 'error';

function getItemKey(item: WeatherVoteItem) {
  return `${item.internal_job_id}|${item.forecast_date ?? ""}|${
    item.lens_id ?? ""
  }`;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

function mapVotes(votes: WeatherVoteVote[] | null | undefined) {
  const result: Record<string, WeatherVoteVote> = {};
  (votes ?? []).forEach((vote) => {
    const key = `${vote.internal_job_id}|${vote.forecast_date ?? ""}|${
      vote.lens_id ?? ""
    }`;
    result[key] = vote;
  });
  return result;
}

function dedupeItems(items: WeatherVoteItem[]) {
  const seen = new Set<string>();
  const result: WeatherVoteItem[] = [];
  for (const item of items) {
    const key = getItemKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function buildDateTime(forecastDate?: string | null, timeValue?: string | null) {
  if (!timeValue) return null;

  try {
    // Parse the time string and extract just the time portion (ignore timezone)
    // Format: "2026-01-07 07:10:00+00" -> extract "07:10:00"
    let timePart: string;

    if (timeValue.includes(' ')) {
      // Format: "2026-01-07 07:10:00+00"
      timePart = timeValue.split(' ')[1]?.split('+')[0] || timeValue;
    } else if (timeValue.includes('T')) {
      // Format: "2026-01-07T07:10:00+00"
      timePart = timeValue.split('T')[1]?.split('+')[0] || timeValue;
    } else {
      timePart = timeValue;
    }

    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      return null;
    }

    // Create a date object with the parsed time (no timezone conversion)
    const date = new Date();
    date.setHours(hours, minutes, seconds || 0, 0);
    return date;
  } catch {
    return null;
  }
}

type VoteLandingProps = {
  token: string;
};

export function VoteLanding({ token }: VoteLandingProps) {
  const [viewState, setViewState] = useState<ViewState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<WeatherVoteContext | null>(null);
  const [items, setItems] = useState<WeatherVoteItem[]>([]);
  const [votes, setVotes] = useState<Record<string, WeatherVoteVote | null>>({});
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [expandedWeather, setExpandedWeather] = useState<Set<string>>(new Set());
  const [weatherData, setWeatherData] = useState<Record<string, any>>({});
  const [loadingWeather, setLoadingWeather] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState({
    total_items: 0,
    voted_items: 0,
    remaining_items: 0,
  });

  const voterIdentity = useMemo(() => {
    if (!context) return "Voter";
    const voterType = String(context.voter_type ?? "").toLowerCase();
    if (voterType === "employee") {
      if (context.employee_full_name) return context.employee_full_name;
      if (context.employee_id != null) return `Employee #${context.employee_id}`;
      return "Employee";
    }
    if (voterType === "estimator") {
      const firstInitials =
        items.find((item) => item.estimator_initials)?.estimator_initials ??
        null;
      return firstInitials ?? "Estimator";
    }
    return "Voter";
  }, [context, items]);

  const loadContext = useCallback(async (options?: { showLoading?: boolean; allowViewReset?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    const allowViewReset = options?.allowViewReset ?? showLoading;
    if (!token) {
      setError("Missing token.");
      setViewState('error');
      return;
    }

    if (showLoading) {
      setViewState('loading');
    }
    setError(null);

    try {
      const response = await fetch("/api/weather-vote/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.message || "Invalid or expired link.");
      }

      const payload = await response.json();
      const rawContext = payload.context;
      const contextData = (Array.isArray(rawContext) ? rawContext[0] : rawContext) as WeatherVoteContext;

      setContext(contextData);

      const rawItems = contextData?.items ?? [];
      const mappedItems = rawItems
        .map((item: any) => {
          const internalJobId =
            item.internal_job_id ?? item.job_id ?? item.acm_job_id;
          const forecastDate = item.forecast_date ?? item.date;
          const lensId = item.lens_id ?? item.lens ?? null;
          if (internalJobId == null || !forecastDate || lensId == null) {
            console.warn("Skipping invalid item row", item);
            return null;
          }
          const existingVote = item.existing_vote ?? null;
          return {
            internal_job_id: Number(internalJobId),
            forecast_date: String(forecastDate),
            lens_id: lensId,
            property_name: item.property_name ?? null,
            service_name: item.service_name ?? null,
            estimator_initials: item.estimator_initials ?? null,
            risk_level: item.risk_level ?? null,
            route_start_time: item.route_start_time ?? null,
            route_end_time: item.route_end_time ?? null,
            max_rain_chance: item.max_rain_chance ?? null,
            max_rain_inches_route: item.max_rain_inches_route ?? null,
            hourly_weather: item.hourly_weather ?? null,
            existing_vote: existingVote,
          } as WeatherVoteItem & { existing_vote?: any };
        })
        .filter(Boolean) as WeatherVoteItem[];

      const contextItems = dedupeItems(mappedItems);
      const contextVotes = mapVotes(contextData.votes ?? []);

      const voteFromItems: Record<string, WeatherVoteVote> = {};
      contextItems.forEach((item: any) => {
        const existingVote = item.existing_vote;
        if (!existingVote) return;
        const key = getItemKey(item);
        voteFromItems[key] = {
          internal_job_id: item.internal_job_id,
          forecast_date: item.forecast_date,
          lens_id: item.lens_id,
          vote_value: existingVote.vote_value ?? null,
          vote_reason: existingVote.vote_reason ?? null,
          voted_at: existingVote.voted_at ?? null,
        };
      });

      const mergedVotes = { ...voteFromItems, ...contextVotes };
      setItems(contextItems);
      setVotes(mergedVotes);

      const totalItems = contextData?.total_items ?? contextItems.length;
      const votedItems =
        contextData?.voted_items ??
        contextData?.total_voted ??
        Object.keys(mergedVotes).length;
      const remainingItems =
        contextData?.remaining_items ??
        contextData?.total_remaining ??
        Math.max(0, Number(totalItems ?? 0) - Number(votedItems ?? 0));
      setCounts({
        total_items: Number(totalItems ?? 0),
        voted_items: Number(votedItems ?? 0),
        remaining_items: Number(remainingItems ?? 0),
      });

      setCurrentJobIndex((prev) =>
        prev >= contextItems.length ? Math.max(0, contextItems.length - 1) : prev
      );

      // Determine initial view state
      const allVoted = contextItems.every((item) => {
        const key = getItemKey(item);
        return !!mergedVotes[key]?.vote_value;
      });

      if (allVoted && contextItems.length > 0) {
        setViewState('summary');
      } else if (allowViewReset) {
        setViewState('welcome');
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid or expired link.";
      setError(message);
      setViewState('error');
    }
  }, [token]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (viewState !== 'voting') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        setCurrentJobIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        setCurrentJobIndex((index) =>
          Math.min(items.length - 1, index + 1)
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [items.length, viewState]);

  const submitVote = useCallback(
    async (payload: SubmitPayload, key: string) => {
      setSubmitting(true);

      try {
        const response = await fetch("/api/weather-vote/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const payloadError = await response.json();
          throw new Error(payloadError.message || "Submit failed.");
        }

        const updatedVotes = {
          ...votes,
          [key]: {
            internal_job_id: payload.internalJobId,
            forecast_date: payload.forecastDate,
            lens_id: payload.lensId,
            vote_value: payload.voteValue,
            vote_reason: payload.voteReason ?? null,
            voted_at: new Date().toISOString(),
          },
        };

        setVotes(updatedVotes);

        // Find the next unvoted job after the current one
        const nextUnvotedIndex = items.findIndex((item, idx) => {
          if (idx <= currentJobIndex) return false;
          const itemKey = getItemKey(item);
          return !updatedVotes[itemKey]?.vote_value;
        });

        // Move to next unvoted job or summary
        setTimeout(() => {
          if (nextUnvotedIndex >= 0) {
            setCurrentJobIndex(nextUnvotedIndex);
          } else {
            setViewState('summary');
          }
          setSubmitting(false);
        }, 800); // Small delay for animation
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submit failed.";
        alert(message);
        setSubmitting(false);
      }
    },
    [currentJobIndex, items.length]
  );

  const handleVote = useCallback(
    (value: string, reason: string) => {
      const item = items[currentJobIndex];
      if (!item) return;
      const key = getItemKey(item);
      submitVote(
        {
          token,
          internalJobId: item.internal_job_id,
          forecastDate: item.forecast_date ?? null,
          lensId: item.lens_id ?? null,
          voteValue: value,
          voteReason: reason ?? null,
        },
        key
      );
    },
    [currentJobIndex, items, submitVote, token]
  );

  const toggleWeather = useCallback(
    async (item: WeatherVoteItem) => {
      const key = getItemKey(item);
      setExpandedWeather((prev) => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return next;
      });

      if (weatherData[key] || loadingWeather.has(key)) return;

      setLoadingWeather((prev) => new Set(prev).add(key));
      try {
        const response = await fetch(
          `/api/weather-vote/job-weather?jobId=${encodeURIComponent(
            item.internal_job_id
          )}&forecastDate=${encodeURIComponent(item.forecast_date ?? "")}`
        );
        if (!response.ok) {
          const payload = await response.json();
          throw new Error(payload.message || "Weather lookup failed.");
        }
        const payload = await response.json();
        setWeatherData((prev) => ({ ...prev, [key]: payload.weather }));
      } catch (err) {
        console.error("Weather fetch error:", err);
        setWeatherData((prev) => ({ ...prev, [key]: null }));
      } finally {
        setLoadingWeather((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [loadingWeather, weatherData]
  );

  // Loading state
  if (viewState === 'loading') {
    return (
      <div className="weather-vote-container">
        <div className="weather-vote-content">
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem', textAlign: 'center' }}>
            Loading your voting session...
          </p>
          {[1, 2, 3].map((index) => (
            <div key={index} className="loading-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (viewState === 'error') {
    return <ErrorState message={error || "An error occurred."} />;
  }

  // Welcome screen
  if (viewState === 'welcome') {
    const totalJobs =
      counts.remaining_items > 0 ? counts.remaining_items : items.length;
    const hasVotedItems = items.some((item) => {
      const key = getItemKey(item);
      return votes[key]?.vote_value;
    });
    return (
      <WelcomeScreen
        voterName={voterIdentity}
        totalJobs={totalJobs}
        onBegin={() => {
          // Find the first unvoted job
          const firstUnvotedIndex = items.findIndex((item) => {
            const key = getItemKey(item);
            return !votes[key]?.vote_value;
          });
          setCurrentJobIndex(firstUnvotedIndex >= 0 ? firstUnvotedIndex : 0);
          setViewState('voting');
        }}
        onGoToSummary={() => setViewState('summary')}
        hasSummary={hasVotedItems}
      />
    );
  }

  // Voting screen (one job at a time)
  if (viewState === 'voting') {
    const currentItem = items[currentJobIndex];
    if (!currentItem) {
      setViewState('summary');
      return null;
    }

    const key = getItemKey(currentItem);

    return (
      <SingleJobView
        item={currentItem}
        currentIndex={currentJobIndex}
        totalJobs={items.length}
        isWeatherExpanded={expandedWeather.has(key)}
        isWeatherLoading={loadingWeather.has(key)}
        weatherData={weatherData[key] ?? null}
        onToggleWeather={() => toggleWeather(currentItem)}
        onVote={handleVote}
        submitting={submitting}
        jobStartTime={buildDateTime(currentItem.forecast_date, currentItem.route_start_time)}
        jobEndTime={buildDateTime(currentItem.forecast_date, currentItem.route_end_time)}
        onNavigatePrev={() => {
          if (currentJobIndex > 0) {
            setCurrentJobIndex(currentJobIndex - 1);
          }
        }}
        onNavigateNext={() => {
          if (currentJobIndex < items.length - 1) {
            setCurrentJobIndex(currentJobIndex + 1);
          }
        }}
        canNavigatePrev={currentJobIndex > 0}
        canNavigateNext={currentJobIndex < items.length - 1}
      />
    );
  }

  // Summary screen
  if (viewState === 'summary') {
    return (
      <SummaryScreen
        token={token}
        voterName={voterIdentity}
        items={items}
        votes={votes}
        onGoBack={() => setViewState('welcome')}
      />
    );
  }

  return null;
}
