"use client";

import { triggerHaptic } from "@/lib/haptics";
import "@/styles/weather-vote.css";

type WelcomeScreenProps = {
  voterName: string;
  totalJobs: number;
  onBegin: () => void;
  onGoToSummary?: () => void;
  hasSummary?: boolean;
};

export function WelcomeScreen({ voterName, totalJobs, onBegin, onGoToSummary, hasSummary }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      {/* Navigation arrows */}
      <div className="screen-navigation">
        <div className="nav-arrow-placeholder"></div>
        {hasSummary && onGoToSummary && (
          <button
            onClick={() => {
              triggerHaptic('light');
              onGoToSummary();
            }}
            className="nav-arrow nav-arrow-right"
            aria-label="Go to summary"
          >
            →
          </button>
        )}
      </div>

      <div className="welcome-content">
        {/* Disclaimer at the top */}
        <div className="welcome-disclaimer-top">
          <div className="disclaimer-icon">⚠️</div>
          <div className="disclaimer-content">
            <div className="disclaimer-title">IMPORTANT NOTICE</div>
            <div className="disclaimer-text">
              Only Tyler and Bob may cancel jobs. This form helps give us context at dispatch to make the correct decisions.
            </div>
          </div>
        </div>

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
