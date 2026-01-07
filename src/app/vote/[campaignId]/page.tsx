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
  status: string | null;
  vote: "go" | "delay" | "hold" | null;
  delay_minutes: number | null;
  comment: string | null;
};

type Vote = "go" | "delay" | "hold";

const delayOptions = [30, 60, 90, 120];

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
  const lastSavedComment = useRef<Record<string, string | null>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    async (
      assignmentId: string,
      vote: Vote,
      delayMinutes?: number | null,
      comment?: string | null
    ) => {
      setSaving(true);
      setSaveError(null);

      try {
        const response = await fetch("/api/vote/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assignmentId,
            vote,
            delay_minutes: delayMinutes ?? undefined,
            comment: comment ?? undefined,
          }),
        });

        if (!response.ok) {
          const errorPayload = await response.json();
          throw new Error(errorPayload.error || "Failed to save vote.");
        }

        const data = await response.json();
        const updated = data.assignment;
        lastSavedComment.current[assignmentId] =
          updated.comment ?? comment ?? null;

        setAssignments((prev) =>
          prev.map((assignment) =>
            assignment.assignmentId === assignmentId
              ? {
                  ...assignment,
                  vote: updated.vote ?? vote,
                  delay_minutes:
                    updated.delay_minutes ?? delayMinutes ?? null,
                  comment: updated.comment ?? comment ?? null,
                  status: updated.status ?? assignment.status,
                }
              : assignment
          )
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Save failed.";
        setSaveError(message);
      } finally {
        setSaving(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!current || !current.vote) return;
    if (current.vote === "delay" && !current.delay_minutes) return;

    const savedComment = lastSavedComment.current[current.assignmentId] ?? null;
    if (current.comment === savedComment) return;

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      submitVote(
        current.assignmentId,
        current.vote!,
        current.delay_minutes,
        current.comment
      );
    }, 600);

    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, [
    current?.comment,
    current?.vote,
    current?.delay_minutes,
    current?.assignmentId,
    submitVote,
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
                      {assignment.property_name || "Job"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {assignment.service_name || "Service"}
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
            <button className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
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
                {current?.property_name || "Job"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {current?.service_name || "Service"} •{" "}
                {current?.route_start_time || "TBD"} -{" "}
                {current?.route_end_time || "TBD"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <p>Risk: {current?.risk_level || "N/A"}</p>
              <p>Rain chance: {current?.max_rain_chance ?? "N/A"}</p>
              <p>Rain inches: {current?.max_rain_inches_route ?? "N/A"}</p>
            </div>
          </div>

          {current?.violated_rules_text && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {current.violated_rules_text}
            </div>
          )}

          {current?.hourly_weather && (
            <div className="mt-4 text-xs text-slate-500">
              Hourly weather:{" "}
              <span className="font-mono text-slate-700">
                {typeof current.hourly_weather === "string"
                  ? current.hourly_weather
                  : JSON.stringify(current.hourly_weather)}
              </span>
            </div>
          )}

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {(["go", "delay", "hold"] as Vote[]).map((vote) => (
              <button
                key={vote}
                onClick={() => {
                  updateAssignment(current.assignmentId, {
                    vote,
                    delay_minutes: vote === "delay" ? current.delay_minutes : null,
                  });
                  if (vote !== "delay") {
                    submitVote(
                      current.assignmentId,
                      vote,
                      null,
                      current.comment
                    );
                  }
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
                      submitVote(
                        current.assignmentId,
                        "delay",
                        minutes,
                        current.comment
                      );
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
                <button
                  onClick={() => {
                    if (!current.delay_minutes) return;
                    submitVote(
                      current.assignmentId,
                      "delay",
                      current.delay_minutes,
                      current.comment
                    );
                  }}
                  className="rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Save delay
                </button>
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
            <p className="mt-3 text-xs text-slate-400">Saving...</p>
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
            onClick={() =>
              setCurrentIndex((index) =>
                Math.min(assignments.length, index + 1)
              )
            }
            disabled={!canAdvance || saving}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {currentIndex + 1 >= assignments.length ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
