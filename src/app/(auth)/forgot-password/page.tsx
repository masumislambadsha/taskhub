"use client";
import { MdMarkEmailRead } from 'react-icons/md';

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-primary/5 p-8">
        {sent ? (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto">
              <MdMarkEmailRead className="text-secondary text-3xl" />
            </div>
            <h1 className="font-headline text-2xl font-bold text-primary">
              Check your inbox
            </h1>
            <p className="text-primary/60 text-sm leading-relaxed">
              If an account exists for{" "}
              <span className="font-semibold text-primary">{email}</span>, we
              sent a password reset link. It expires in 1 hour.
            </p>
            <Link
              href="/login"
              className="inline-block mt-4 text-secondary font-semibold text-sm hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="font-headline text-2xl font-bold text-primary mb-2">
                Forgot your password?
              </h1>
              <p className="text-primary/60 text-sm">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="text-center text-sm text-primary/60 mt-6">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-secondary font-semibold hover:underline"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}


