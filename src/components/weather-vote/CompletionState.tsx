"use client";

import { useEffect } from "react";
import { confettiBurst } from "@/lib/celebration";
import "@/styles/weather-vote.css";

type CompletionStateProps = {
  remaining: number;
};

export function CompletionState({ remaining }: CompletionStateProps) {
  useEffect(() => {
    if (remaining === 0) {
      confettiBurst(50);
    }
  }, [remaining]);

  if (remaining > 0) {
    return null;
  }

  return (
    <div className="completion-banner">
      <h2>All votes submitted!</h2>
      <p>Thank you for completing your review.</p>
    </div>
  );
}
