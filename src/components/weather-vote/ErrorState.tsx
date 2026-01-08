"use client";

import "@/styles/weather-vote.css";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "Invalid or expired link", message }: ErrorStateProps) {
  return (
    <div className="weather-vote-container">
      <div className="weather-vote-content">
        <div className="error-card">
          <h1>{title}</h1>
          <p>{message}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#991b1b' }}>
            Request a new voting link if you need access.
          </p>
        </div>
      </div>
    </div>
  );
}
