"use client";

import { triggerHaptic } from "@/lib/haptics";
import "@/styles/weather-vote.css";

type WelcomeScreenProps = {
  voterName: string;
  totalJobs: number;
  onBegin: () => void;
};

export function WelcomeScreen({ voterName, totalJobs, onBegin }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon">👋</div>
        <h1 className="welcome-title">Hello, {voterName}!</h1>
        <p className="welcome-subtitle">
          Welcome to your weather voting session
        </p>
        <div className="welcome-info">
          <p>You have <strong>{totalJobs} job{totalJobs !== 1 ? 's' : ''}</strong> to review today.</p>
          <p>For each job, you'll see weather conditions and make a decision.</p>
        </div>
        <button
          onClick={() => {
            triggerHaptic('medium');
            onBegin();
          }}
          className="welcome-begin-btn"
        >
          Begin Voting
        </button>
      </div>
    </div>
  );
}
