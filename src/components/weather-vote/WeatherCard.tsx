"use client";

import { useEffect, useMemo, useRef } from "react";

type WeatherCardProps = {
  jobId: number;
  jobAddress: string | null;
  showWeather: boolean;
  isExpanded: boolean;
  isLoading: boolean;
  weatherData: any | null;
  onToggle: () => void;
  jobStartTime?: Date | null;
  jobEndTime?: Date | null;
};

function formatHour(timeValue: string) {
  const date = new Date(timeValue);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true });
  }
  return timeValue;
}

function getHour(timeValue: string) {
  const date = new Date(timeValue);
  if (!Number.isNaN(date.getTime())) {
    return date.getHours();
  }
  return null;
}

function getTempStyles(tempF: number, condition: string) {
  const isSunny =
    condition.toLowerCase().includes("sun") ||
    condition.toLowerCase().includes("clear");
  if (tempF <= 33) {
    return {
      color: "#7c3aed",
      background: "rgba(233, 213, 255, 0.5)",
      border: "rgba(124, 58, 237, 0.3)",
    };
  }
  if (tempF >= 65 && isSunny) {
    return {
      color: "#16a34a",
      background: "rgba(187, 247, 208, 0.6)",
      border: "rgba(22, 163, 74, 0.35)",
    };
  }
  return {
    color: "#2563eb",
    background: "rgba(219, 234, 254, 0.5)",
    border: "rgba(59, 130, 246, 0.3)",
  };
}

export function WeatherCard({
  jobId,
  jobAddress,
  showWeather,
  isExpanded,
  isLoading,
  weatherData,
  onToggle,
  jobStartTime,
  jobEndTime,
}: WeatherCardProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const routeStartHour = jobStartTime ? jobStartTime.getHours() : null;
  const routeEndHour = jobEndTime ? jobEndTime.getHours() : null;

  useEffect(() => {
    if (!isExpanded || !weatherData || !scrollContainerRef.current) return;
    if (routeStartHour == null) return;
    const startHourElement = scrollContainerRef.current.querySelector(
      `[data-hour="${routeStartHour}"]`
    ) as HTMLElement | null;
    if (startHourElement) {
      setTimeout(() => {
        startHourElement.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "start",
        });
      }, 100);
    }
  }, [isExpanded, weatherData, routeStartHour]);

  const hourlyWeather = useMemo(() => {
    if (!weatherData) return [];
    try {
      const raw = weatherData.hourly_weather;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [weatherData]);

  if (!showWeather || !jobAddress) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-orange-50 via-white to-orange-100 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Weather Forecast</p>
          <p className="text-xs text-slate-500">Job #{jobId}</p>
        </div>
        <button
          onClick={onToggle}
          className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold uppercase text-orange-700"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {isLoading && (
        <p className="mt-2 text-xs text-slate-400">Loading weather...</p>
      )}
      {!isLoading && !weatherData && (
        <p className="mt-2 text-xs text-slate-500">Weather not available.</p>
      )}

      {weatherData && (
        <>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-gradient-to-r from-red-500 to-red-400 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-wide text-red-100">High</p>
              <p className="text-2xl font-semibold">
                {weatherData.daily_high_temp_f != null
                  ? Math.round(weatherData.daily_high_temp_f)
                  : "--"}
                F
              </p>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-blue-500 to-blue-400 px-4 py-3 text-white">
              <p className="text-xs uppercase tracking-wide text-blue-100">Low</p>
              <p className="text-2xl font-semibold">
                {weatherData.daily_low_temp_f != null
                  ? Math.round(weatherData.daily_low_temp_f)
                  : "--"}
                F
              </p>
            </div>
          </div>

          {weatherData.worst_hour && !isExpanded && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <p className="font-semibold">Worst conditions</p>
              <p className="mt-1">
                {formatHour(weatherData.worst_hour.time)} -{" "}
                {weatherData.worst_hour.condition}
              </p>
            </div>
          )}

          {isExpanded && (
            <div
              ref={scrollContainerRef}
              className="mt-4 flex gap-2 overflow-x-auto pb-2"
            >
              {hourlyWeather.map((hour: any, idx: number) => {
                const currentHour = getHour(String(hour.time ?? ""));
                const isWithinJobTime =
                  currentHour !== null &&
                  routeStartHour !== null &&
                  routeEndHour !== null &&
                  currentHour >= routeStartHour &&
                  currentHour <= routeEndHour;
                const isJobStartHour = currentHour === routeStartHour;
                const isJobEndHour = currentHour === routeEndHour;
                const tempStyles = getTempStyles(
                  Number(hour.tempF ?? 0),
                  String(hour.condition ?? "")
                );

                return (
                  <div
                    key={`${hour.time ?? idx}`}
                    data-hour={currentHour ?? undefined}
                    className="min-w-[110px] rounded-xl border px-3 py-2 text-xs shadow-sm"
                    style={{
                      borderColor: isWithinJobTime ? "#f59e0b" : tempStyles.border,
                      borderWidth: isWithinJobTime ? "3px" : "1px",
                      background: isWithinJobTime
                        ? "rgba(251, 191, 36, 0.15)"
                        : tempStyles.background,
                    }}
                  >
                    {isJobStartHour && (
                      <span className="mb-1 inline-flex rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Job Start
                      </span>
                    )}
                    <p className="font-semibold text-slate-900">
                      {formatHour(String(hour.time ?? ""))}
                    </p>
                    <p style={{ color: tempStyles.color }}>
                      {Math.round(Number(hour.tempF ?? 0))}F
                    </p>
                    {Number(hour.feelsLikeF ?? hour.tempF) !== Number(hour.tempF) && (
                      <p className="text-[10px] text-slate-500">
                        feels {Math.round(Number(hour.feelsLikeF))}F
                      </p>
                    )}
                    <p className="text-[10px] text-slate-500">
                      {hour.condition ?? ""}
                    </p>
                    {Number(hour.rainChance ?? 0) > 0 && (
                      <p className="text-[10px] text-slate-600">
                        Rain {Math.round(Number(hour.rainChance))}%
                      </p>
                    )}
                    {Number(hour.rainInches ?? 0) > 0 && (
                      <p className="text-[10px] text-slate-600">
                        {Number(hour.rainInches).toFixed(2)}" rain
                      </p>
                    )}
                    {Number(hour.windSpeedMph ?? 0) > 5 && (
                      <p className="text-[10px] text-slate-600">
                        Wind {Math.round(Number(hour.windSpeedMph))} mph
                      </p>
                    )}
                    {isJobEndHour && (
                      <span className="mt-1 inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                        Job End
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
  );
}
