"use client";

import type { WeatherVoteItem, WeatherVoteVote } from "@/lib/weather-vote";
import { VoteCard } from "@/components/weather-vote/VoteCard";

type VoteListProps = {
  items: WeatherVoteItem[];
  votes: Record<string, WeatherVoteVote | null>;
  reasons: Record<string, string>;
  onReasonChange: (key: string, next: string) => void;
  onVote: (key: string, value: string, reason: string) => void;
  submittingKey: string | null;
  errors: Record<string, string | null>;
  expandedWeather: Set<string>;
  weatherData: Record<string, any>;
  loadingWeather: Set<string>;
  onToggleWeather: (item: WeatherVoteItem) => void;
  buildDateTime: (forecastDate?: string | null, timeValue?: string | null) => Date | null;
};

export function VoteList({
  items,
  votes,
  reasons,
  onReasonChange,
  onVote,
  submittingKey,
  errors,
  expandedWeather,
  weatherData,
  loadingWeather,
  onToggleWeather,
  buildDateTime,
}: VoteListProps) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const key = `${item.internal_job_id}|${item.forecast_date ?? ""}|${
          item.lens_id ?? ""
        }`;
        return (
          <VoteCard
            key={key}
            item={item}
            vote={votes[key] ?? null}
            reason={reasons[key] ?? ""}
            onReasonChange={(next) => onReasonChange(key, next)}
            onVote={(value, reason) => onVote(key, value, reason)}
            submitting={submittingKey === key}
            error={errors[key]}
            isWeatherExpanded={expandedWeather.has(key)}
            isWeatherLoading={loadingWeather.has(key)}
            weatherData={weatherData[key] ?? null}
            onToggleWeather={() => onToggleWeather(item)}
            jobStartTime={buildDateTime(item.forecast_date, item.route_start_time)}
            jobEndTime={buildDateTime(item.forecast_date, item.route_end_time)}
          />
        );
      })}
    </div>
  );
}
