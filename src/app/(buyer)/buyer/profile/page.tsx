"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function BuyerProfilePage() {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Left: Avatar + identity */}
        <div className="lg:col-span-4 flex flex-col items-center lg:items-start">
          <div className="relative mb-6">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={192}
                height={192}
                className="w-48 h-48 rounded-2xl object-cover shadow-[0_24px_40px_-15px_rgba(11,30,38,0.12)] border-4 border-white"
              />
            ) : (
              <div className="w-48 h-48 rounded-2xl bg-surface-container flex items-center justify-center shadow-[0_24px_40px_-15px_rgba(11,30,38,0.12)] border-4 border-white">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontSize: 80 }}
                >
                  account_circle
                </span>
              </div>
            )}
            <div className="absolute -bottom-3 -right-3 bg-secondary p-3 rounded-full text-white shadow-lg">
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                storefront
              </span>
            </div>
          </div>

          <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tight mb-2 text-center lg:text-left">
            {session?.user?.name ?? "Buyer"}
          </h1>
          <p className="font-body text-on-surface-variant text-sm mb-6 text-center lg:text-left">
            {session?.user?.email}
          </p>

          <div className="flex gap-2 flex-wrap mb-6 justify-center lg:justify-start">
            <span className="bg-secondary/10 text-secondary px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest font-bold">
              Buyer Account
            </span>
          </div>

          <button className="flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
            <span className="material-symbols-outlined text-sm">upload</span>
            Upload Photo
          </button>
          <p className="text-xs text-primary/40 mt-1">JPG, PNG up to 2MB</p>
        </div>

        {/* Right: Stats */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-lowest transition-all shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 group-hover:scale-110 transition-transform">
                task_alt
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-primary">
                  0
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-on-surface-variant mt-1">
                  Tasks Posted
                </p>
              </div>
            </div>

            <div className="bg-primary-container p-8 rounded-xl flex flex-col justify-between shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)]">
              <span
                className="material-symbols-outlined text-secondary text-3xl mb-4"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                toll
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-on-primary-container">
                  {session?.user?.coins ?? 0}
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-on-primary-container/70 mt-1">
                  Coin Balance
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between hover:bg-surface-container-lowest transition-all shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] group">
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 group-hover:scale-110 transition-transform">
                group
              </span>
              <div>
                <h3 className="font-headline text-3xl font-extrabold text-primary">
                  0
                </h3>
                <p className="font-label uppercase text-[10px] tracking-widest text-on-surface-variant mt-1">
                  Workers Hired
                </p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-3 bg-surface-container-lowest p-8 rounded-xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h3 className="font-headline text-xl font-bold text-primary mb-2">
                    Coin Balance
                  </h3>
                  <p className="font-body text-on-surface-variant text-sm max-w-md">
                    Top up your coins to post tasks and hire workers across the
                    platform.
                  </p>
                </div>
                <Link
                  href="/buyer/coins"
                  className="shrink-0 flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-lg font-semibold text-sm hover:bg-secondary/90 transition-colors"
                >
                  Buy Coins
                  <span className="material-symbols-outlined text-sm">
                    arrow_forward
                  </span>
                </Link>
              </div>
              <div className="absolute right-0 top-0 w-64 h-full bg-linear-to-l from-secondary-container/10 to-transparent pointer-events-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Edit Profile Form */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
            Account Details
          </h2>
        </div>

        <div className="bg-surface-container-lowest rounded-2xl shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)] p-8 space-y-6">
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Full Name
              </label>
              <input
                type="text"
                defaultValue={session?.user?.name ?? ""}
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Email
              </label>
              <input
                type="email"
                defaultValue={session?.user?.email ?? ""}
                disabled
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm bg-surface-container text-on-surface-variant cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="Optional"
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Website
              </label>
              <input
                type="url"
                placeholder="https://"
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                About
              </label>
              <textarea
                rows={4}
                placeholder="Tell workers about your projects..."
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none bg-background"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-primary/5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-sm animate-spin">
                    refresh
                  </span>{" "}
                  Saving...
                </>
              ) : saved ? (
                <>
                  <span className="material-symbols-outlined text-sm">
                    check
                  </span>{" "}
                  Saved
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
