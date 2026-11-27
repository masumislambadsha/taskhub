"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/api-error";

type State = { enrolled: boolean; verified: boolean; stepUpFresh: boolean };
type Setup = { manualKey: string; qrDataUrl: string };

const card = "w-full max-w-md bg-white rounded-2xl shadow-xl border border-primary/5 p-8 space-y-5";
const input =
  "w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary tracking-widest text-center text-lg";
const button =
  "w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60";

export default function SecurityClient({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [recovery, setRecovery] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (demo) return;
    axios
      .get("/api/v1/admin/mfa/status")
      .then((r) => setState(r.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load your security status")));
  }, [demo]);

  if (demo) {
    return (
      <div className={card}>
        <h1 className="font-headline text-xl font-bold text-primary">Two-factor</h1>
        <p className="text-sm text-primary/60">The read-only demo admin does not use two-factor.</p>
        <button className={button} onClick={() => router.push("/admin/dashboard")}>
          Continue
        </button>
      </div>
    );
  }
  if (!state) return <div className={card}>Loading…</div>;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  const startSetup = () =>
    run(async () => setSetup((await axios.post("/api/v1/admin/mfa/setup")).data));

  const confirmSetup = () =>
    run(async () => {
      const r = await axios.post("/api/v1/admin/mfa/enable", { code });
      setRecovery(r.data.recoveryCodes);
      setCode("");
    });

  const verify = () =>
    run(async () => {
      await axios.post("/api/v1/admin/mfa/verify", { code });
      router.push("/admin/dashboard");
      router.refresh();
    });

  if (recovery) {
    return (
      <div className={card}>
        <h1 className="font-headline text-xl font-bold text-primary">Save your recovery codes</h1>
        <p className="text-sm text-primary/60">
          Each code works once if you lose your phone. They are shown only now: write them down
          or keep them in a password manager.
        </p>
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm bg-background rounded-lg p-4">
          {recovery.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <button
          className={button}
          onClick={() => {
            router.push("/admin/dashboard");
            router.refresh();
          }}
        >
          I saved them, continue
        </button>
      </div>
    );
  }

  if (!state.enrolled) {
    return (
      <div className={card}>
        <h1 className="font-headline text-xl font-bold text-primary">Set up two-factor</h1>
        <p className="text-sm text-primary/60">
          Admins must use an authenticator app (Google Authenticator, Authy, 1Password…) before
          using the admin area.
        </p>
        {!setup ? (
          <button className={button} onClick={startSetup} disabled={busy}>
            Start setup
          </button>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qrDataUrl} alt="QR code for your authenticator app" className="mx-auto w-48 h-48" />
            <p className="text-xs text-primary/60 text-center">
              Cannot scan it? Enter this key by hand:
              <br />
              <span className="font-mono text-sm text-primary break-all">{setup.manualKey}</span>
            </p>
            <input
              className={input}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button className={button} onClick={confirmSetup} disabled={busy || code.length !== 6}>
              Confirm and turn on
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={card}>
      <h1 className="font-headline text-xl font-bold text-primary">Enter your code</h1>
      <p className="text-sm text-primary/60">
        Open your authenticator app and enter the 6-digit code, or use a recovery code.
      </p>
      <input
        className={input}
        autoComplete="one-time-code"
        maxLength={11}
        placeholder="123456"
        value={code}
        onChange={(e) => setCode(e.target.value.trim())}
        onKeyDown={(e) => e.key === "Enter" && code && verify()}
      />
      <button className={button} onClick={verify} disabled={busy || !code}>
        Verify
      </button>
    </div>
  );
}
