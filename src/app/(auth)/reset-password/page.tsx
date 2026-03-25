"use client";
import { MdCheckCircle, MdError, MdVisibility, MdVisibilityOff } from 'react-icons/md';

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto">
          <MdError className="text-red-500 text-3xl" />
        </div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Invalid link
        </h1>
        <p className="text-primary/60 text-sm">
          This reset link is missing or malformed.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block mt-2 text-secondary font-semibold text-sm hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
          <MdCheckCircle className="text-secondary text-3xl" />
        </div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Password updated
        </h1>
        <p className="text-primary/60 text-sm">
          Your password has been reset. Redirecting you to sign in…
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-primary mb-2">
          Set a new password
        </h1>
        <p className="text-primary/60 text-sm">
          Choose a strong password for your account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            New password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary/40 hover:text-secondary transition-colors"
            >
              {showPassword ? (
                <MdVisibilityOff className="text-xl" />
              ) : (
                <MdVisibility className="text-xl" />
              )}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary mb-1.5">
            Confirm password
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary pr-12"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary/40 hover:text-secondary transition-colors"
            >
              {showConfirm ? (
                <MdVisibilityOff className="text-xl" />
              ) : (
                <MdVisibility className="text-xl" />
              )}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Updating…" : "Reset password"}
        </button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-primary/5 p-8">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
