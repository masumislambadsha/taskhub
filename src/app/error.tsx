"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#FFF9E5] flex flex-col">
      <main className="flex-grow flex items-center justify-center px-6 py-12">
        <div className="relative w-full max-w-lg">
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-secondary/10 rounded-full blur-3xl opacity-50" />
          <div className="absolute -bottom-16 -right-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl opacity-40" />

          <div className="relative bg-white shadow-xl rounded-xl overflow-hidden flex flex-col items-center text-center p-8 md:p-12 border border-primary/5">
            <div className="mb-8 p-4 bg-red-50 rounded-full">
              <span
                className="material-symbols-outlined text-red-600"
                style={{ fontSize: 64 }}
              >
                error
              </span>
            </div>

            <h1 className="font-headline text-3xl md:text-4xl font-extrabold text-primary mb-4 tracking-tight">
              Something went wrong
            </h1>
            <p className="text-primary/60 text-lg leading-relaxed mb-10 max-w-sm">
              We&apos;ve encountered an unexpected error. Our team has been
              notified.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
              <button
                onClick={reset}
                className="bg-primary text-white px-8 py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all shadow-lg"
              >
                <span className="material-symbols-outlined text-sm">
                  refresh
                </span>
                Try again
              </button>
              <Link
                href="/"
                className="border border-primary/10 text-primary/70 hover:bg-primary/5 px-8 py-3.5 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                Go home
              </Link>
            </div>

            {error.digest && (
              <div className="mt-10 pt-8 border-t border-primary/5 w-full flex flex-col items-center">
                <span className="text-[10px] uppercase tracking-[0.15em] text-primary/40 mb-1">
                  Reference ID
                </span>
                <span className="text-xs font-medium text-primary/50">
                  {error.digest}
                </span>
              </div>
            )}
          </div>

          <div className="mt-8 text-center opacity-40">
            <span className="text-[10px] tracking-[0.2em] uppercase text-primary">
              TaskHub Operational Integrity Unit
            </span>
          </div>
        </div>
      </main>

      <footer className="bg-[#FFF9E5] border-t border-primary/10 py-10 px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary/40">
            © 2024 TaskHub. The Editorial Artisan.
          </p>
          <div className="flex gap-6">
            {["About", "FAQ", "Terms", "Privacy"].map((l) => (
              <Link
                key={l}
                href={`/${l.toLowerCase()}`}
                className="text-sm text-primary/50 hover:text-primary underline decoration-secondary underline-offset-4 transition-colors"
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
