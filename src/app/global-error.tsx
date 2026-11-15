"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Renders when the root layout itself fails. Replaces the whole document.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // No-op when Sentry is not initialised.
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong</h1>
        <p style={{ margin: 0, opacity: 0.7 }}>
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>
            Reference ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            border: "1px solid #ccc",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
