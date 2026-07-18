"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";

export default function MobileGooglePage() {
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated" && session?.user?.id) {
      fetch("/api/v1/auth/google/mobile-token")
        .then((res) => res.json())
        .then((data) => {
          if (data.token) {
            const userParam = encodeURIComponent(JSON.stringify(data.user));
            window.location.href = `taskhub://callback?token=${data.token}&user=${userParam}`;
          } else {
            setError(data.error || "Failed to get token");
          }
        })
        .catch(() => setError("Failed to get token"));
    }
  }, [status, session]);

  if (error) {
    return (
      <div style={styles.wrapper}>
        <h1 style={styles.errorTitle}>Authentication Error</h1>
        <p style={styles.errorText}>{error}</p>
        <button style={styles.btn} onClick={() => window.close()}>
          Close
        </button>
      </div>
    );
  }

  if (status === "loading" || status === "authenticated") {
    return (
      <div style={styles.wrapper}>
        <p style={styles.loadingText}>
          {status === "authenticated" ? "Redirecting to TaskHub..." : "Loading..."}
        </p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.title}>TaskHub</h1>
      <p style={styles.subtitle}>Sign in to continue to the app</p>
      <button
        onClick={() => signIn("google", { callbackUrl: "/auth/mobile-google" })}
        style={styles.googleBtn}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9E5",
    fontFamily: "system-ui, sans-serif",
    padding: 24,
  },
  title: { color: "#004030", fontSize: 28, fontWeight: 800, marginBottom: 8 },
  subtitle: { color: "rgba(0,64,48,0.6)", marginBottom: 32, fontSize: 15 },
  loadingText: { color: "#004030", fontSize: 16 },
  errorTitle: { color: "#D32F2F", fontSize: 22, fontWeight: 700, marginBottom: 8 },
  errorText: { color: "rgba(0,0,0,0.6)", marginBottom: 24, fontSize: 14 },
  googleBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: "12px 24px",
    border: "1px solid rgba(0,64,48,0.2)",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    cursor: "pointer",
    fontSize: 16,
    color: "#004030",
    fontWeight: 600,
    width: "100%",
    maxWidth: 320,
  },
  btn: {
    padding: "10px 24px",
    border: "none",
    borderRadius: 6,
    backgroundColor: "#004030",
    color: "#FFFFFF",
    cursor: "pointer",
    fontSize: 14,
  },
};
