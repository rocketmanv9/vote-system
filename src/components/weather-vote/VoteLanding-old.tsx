"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { triggerHaptic } from "@/lib/haptics";
import type { WeatherVoteContext, WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import { CompletionState } from "@/components/weather-vote/CompletionState";
import { ErrorState } from "@/components/weather-vote/ErrorState";
import { VoteList } from "@/components/weather-vote/VoteList";
import "@/styles/weather-vote.css";

type SubmitPayload = {
  token: string;
  internalJobId: number;
  forecastDate: string | null;
  lensId: string | null;
  voteValue: string;
  voteReason?: string | null;
};

type VoteUpdateCounts = {
  total_items?: number | null;
  total_voted?: number | null;
  total_remaining?: number | null;
  voted_items?: number | null;
  remaining_items?: number | null;
  counts?: {
    total_items?: number | null;
    total_voted?: number | null;
    total_remaining?: number | null;
    voted_items?: number | null;
    remaining_items?: number | null;
  } | null;
};

function getItemKey(item: WeatherVoteItem) {
  return `${item.internal_job_id}|${item.forecast_date ?? ""}|${
    item.lens_id ?? ""
  }`;
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

function formatDateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "Dates unavailable";
  if (start && end) return `${start} - ${end}`;
  return start ?? end ?? "Dates unavailable";
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

function riskRank(risk?: string | null) {
  if (!risk) return 99;
  const value = risk.toLowerCase();
  if (value.includes("red") || value.includes("high")) return 0;
  if (value.includes("yellow") || value.includes("medium")) return 1;
  if (value.includes("green") || value.includes("low")) return 2;
  return 3;
}

function buildDateTime(forecastDate?: string | null, timeValue?: string | null) {
  if (!timeValue) return null;
  if (timeValue.includes("T")) {
    const parsed = new Date(timeValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!forecastDate) return null;
  const combined = new Date(`${forecastDate}T${timeValue}`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

type VoteLandingProps = {
  token: string;
};

export function VoteLanding({ token }: VoteLandingProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<WeatherVoteContext | null>(null);
  const [items, setItems] = useState<WeatherVoteItem[]>([]);
  const [votes, setVotes] = useState<Record<string, WeatherVoteVote | null>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<string, string | null>>(
    {}
  );
  const [expandedWeather, setExpandedWeather] = useState<Set<string>>(new Set());
  const [weatherData, setWeatherData] = useState<Record<string, any>>({});
  const [loadingWeather, setLoadingWeather] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState<{
    total_items: number;
    total_voted: number;
    total_remaining: number;
  }>({
    total_items: 0,
    total_voted: 0,
    total_remaining: 0,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const loadContext = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    if (!token) {
      setError("Missing token.");
      if (showLoading) {
        setLoading(false);
      }
      return;
    }

    if (showLoading) {
      setLoading(true);
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
      const contextData = payload.context as WeatherVoteContext | null;
      if (!contextData) {
        throw new Error("Invalid or expired link.");
      }

      setContext(contextData);

      const rawItems = contextData.items ?? [];
      const mappedItems = rawItems
        .map((item: any) => {
          const internalJobId = item.internal_job_id;
          const forecastDate = item.forecast_date;
          const lensId = item.lens_id ?? null;
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

      const initialReasons: Record<string, string> = {};
      Object.entries(mergedVotes).forEach(([key, vote]) => {
        initialReasons[key] = vote?.vote_reason ?? "";
      });
      setReasons(initialReasons);

      const totalItems =
        contextData.total_items ?? contextItems.length;
      const totalVoted =
        contextData.voted_items ??
        contextData.total_voted ??
        Object.keys(mergedVotes).length;
      const totalRemaining =
        contextData.remaining_items ??
        contextData.total_remaining ??
        Math.max(0, totalItems - totalVoted);
      setCounts({
        total_items: Number(totalItems ?? 0),
        total_voted: Number(totalVoted ?? 0),
        total_remaining: Number(totalRemaining ?? 0),
      });

    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid or expired link.";
      setError(message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const submitVote = useCallback(
    async (payload: SubmitPayload, key: string) => {
      setSubmittingKey(key);
      setSubmitErrors((prev) => ({ ...prev, [key]: null }));

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

        const result = (await response.json()) as { result: VoteUpdateCounts };
        const updatedCounts = result.result?.counts ?? result.result;
        if (updatedCounts) {
          setCounts((prev) => ({
            total_items: updatedCounts.total_items ?? prev.total_items,
            total_voted:
              updatedCounts.voted_items ??
              updatedCounts.total_voted ??
              prev.total_voted,
            total_remaining:
              updatedCounts.remaining_items ??
              updatedCounts.total_remaining ??
              prev.total_remaining,
          }));
        }

        setVotes((prev) => ({
          ...prev,
          [key]: {
            internal_job_id: payload.internalJobId,
            forecast_date: payload.forecastDate,
            lens_id: payload.lensId,
            vote_value: payload.voteValue,
            vote_reason: payload.voteReason ?? null,
            voted_at: new Date().toISOString(),
          },
        }));

        await loadContext({ showLoading: false });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Submit failed.";
        setSubmitErrors((prev) => ({ ...prev, [key]: message }));
        if (message.toLowerCase().includes("not authorized")) {
          await loadContext();
        }
      } finally {
        setSubmittingKey(null);
      }
    },
    [loadContext]
  );

  const handleVote = useCallback(
    (key: string, value: string, reason: string) => {
      const item = items.find((row) => getItemKey(row) === key);
      if (!item) return;
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
    [items, submitVote, token]
  );

  const handleReasonChange = useCallback((key: string, next: string) => {
    setReasons((prev) => ({ ...prev, [key]: next }));
  }, []);

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

  const filteredItems = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const risk = item.risk_level?.toLowerCase() ?? "";
      if (riskFilter !== "all" && !risk.includes(riskFilter)) {
        return false;
      }
      if (!search) return true;
      const haystack = [
        item.property_name,
        item.service_name,
        String(item.internal_job_id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [items, riskFilter, searchTerm]);

  const groupedItems = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      if (a.forecast_date !== b.forecast_date) {
        return String(a.forecast_date).localeCompare(String(b.forecast_date));
      }
      const riskCompare = riskRank(a.risk_level) - riskRank(b.risk_level);
      if (riskCompare !== 0) return riskCompare;
      return String(a.internal_job_id).localeCompare(String(b.internal_job_id));
    });

    const groups: Record<string, WeatherVoteItem[]> = {};
    sorted.forEach((item) => {
      const key = item.forecast_date ?? "Unknown date";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [filteredItems]);

  const tokenWrapper: any = (context as any)?.token ?? {};
  const expiryLabel = formatDateTime(
    tokenWrapper.expires_at ?? (context as any)?.token_expires_at
  );
  const expiresAtValue = tokenWrapper.expires_at ?? (context as any)?.token_expires_at;
  const revokedAtValue = tokenWrapper.revoked_at ?? (context as any)?.token_revoked_at;
  const isExpired = expiresAtValue ? new Date(expiresAtValue) < new Date() : false;
  const isRevoked = !!revokedAtValue;
  const isTokenInvalid = isExpired || isRevoked;

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
        items.find((item) => item.estimator_initials)?.estimator_initials ?? null;
      return firstInitials ?? "Estimator";
    }
    return "Voter";
  }, [context, items]);

  if (loading) {
    return (
      <div className="weather-vote-container">
        <div className="weather-vote-content">
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>Loading voting batch...</p>
          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="loading-skeleton"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title={error === "Missing token." ? "Missing token" : undefined}
        message={error}
      />
    );
  }

  if (isTokenInvalid) {
    return (
      <ErrorState
        message={`This voting link is invalid or expired.${
          isRevoked ? " It has been revoked." : ""
        }${isExpired && expiryLabel ? ` It expired at ${expiryLabel}.` : ""} Request a new voting link.`}
      />
    );
  }

  return (
    <div className="weather-vote-container">
      <div className="weather-vote-content">
        <div className="weather-vote-header">
          <div className="weather-vote-header-info">
            <p className="label">Weather vote</p>
            <h1>Hi {voterIdentity}</h1>
            <p className="remaining">
              {counts.total_remaining} jobs need review
            </p>
          </div>
          <div className="weather-vote-badge">
            <p className="badge-title">
              {formatDateRange(
                (context as any)?.batch?.start_date ?? (context as any)?.batch_start_date,
                (context as any)?.batch?.end_date ?? (context as any)?.batch_end_date
              )}
            </p>
            <p>Status: {(context as any)?.batch?.status ?? context?.batch_status ?? "unknown"}</p>
            <p>
              {counts.total_items} total / {counts.total_voted} voted /{" "}
              {counts.total_remaining} remaining
            </p>
          </div>
        </div>

        <div className="filter-bar">
          <div className="filter-controls">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search property, service, job id..."
              className="search-input"
            />
            <select
              value={riskFilter}
              onChange={(event) => {
                triggerHaptic('selection');
                setRiskFilter(event.target.value);
              }}
              className="risk-select"
            >
              <option value="all">All risk</option>
              <option value="red">Red</option>
              <option value="yellow">Yellow</option>
              <option value="green">Green</option>
            </select>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              loadContext();
            }}
            className="refresh-btn"
          >
            Refresh
          </button>
        </div>

        <CompletionState remaining={counts.total_remaining} />

        {Object.entries(groupedItems).map(([date, group]) => (
          <div key={date} className="date-group">
            <h2>{date}</h2>
            <VoteList
              items={group}
              votes={votes}
              reasons={reasons}
              onReasonChange={handleReasonChange}
              onVote={handleVote}
              submittingKey={submittingKey}
              errors={submitErrors}
              expandedWeather={expandedWeather}
              weatherData={weatherData}
              loadingWeather={loadingWeather}
              onToggleWeather={toggleWeather}
              buildDateTime={buildDateTime}
            />
          </div>
        ))}

        {Object.keys(groupedItems).length === 0 && (
          <div className="empty-state">
            No jobs match your filters.
          </div>
        )}
      </div>
    </div>
  );
}
