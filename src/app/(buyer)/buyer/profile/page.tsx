"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function BuyerProfilePage() {
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Profile card */}
      <div className="bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden">
        {/* Banner */}
        <div className="h-24 bg-primary relative">
          <div className="absolute -bottom-10 left-6 sm:left-8">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt="Profile"

                className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-secondary/20 border-4 border-white shadow-md flex items-center justify-center">
                <span className="material-symbols-outlined text-secondary text-4xl">
                  account_circle
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="pt-14 pb-6 px-6 sm:px-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
                {session?.user?.name ?? "Buyer"}
              </h1>
              <span className="bg-secondary/10 text-secondary px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Buyer
              </span>
            </div>
            <p className="text-sm text-primary/50 mt-0.5">
              {session?.user?.email}
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-2 text-sm font-semibold text-secondary hover:underline shrink-0"
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-5">
          <span className="material-symbols-outlined text-secondary text-xl mb-3 block">
            task_alt
          </span>
          <p className="font-headline text-2xl font-extrabold text-primary">
            0
          </p>
          <p className="text-[11px] uppercase tracking-widest text-primary/40 font-bold mt-1">
            Tasks Posted
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-5">
          <span
            className="material-symbols-outlined text-secondary text-xl mb-3 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            toll
          </span>
          <p className="font-headline text-2xl font-extrabold text-primary">
            {session?.user?.coins ?? 0}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-primary/40 font-bold mt-1">
            Coin Balance
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-primary rounded-2xl p-5 flex flex-col justify-between">
          <span className="material-symbols-outlined text-secondary text-xl mb-3 block">
            group
          </span>
          <p className="font-headline text-2xl font-extrabold text-white">0</p>
          <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-1">
            Workers Hired
          </p>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 sm:p-8">
          <h2 className="font-headline text-lg font-extrabold text-primary mb-6">
            Edit Profile
          </h2>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                Full Name
              </label>
              <input
                type="text"
                defaultValue={session?.user?.name ?? ""}
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
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
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                Company / Organization
              </label>
              <input
                type="text"
                placeholder="Optional"
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                Website
              </label>
              <input
                type="url"
                placeholder="https://"
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                About
              </label>
              <textarea
                rows={4}
                placeholder="Tell workers about your projects..."
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-6 pt-5 border-t border-primary/5">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
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
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-primary/50 hover:bg-primary/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/buyer/coins"
          className="flex items-center gap-4 bg-white rounded-2xl border border-primary/5 shadow-sm p-5 hover:border-secondary/20 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
            <span
              className="material-symbols-outlined text-secondary text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              toll
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-primary text-sm">Buy Coins</p>
            <p className="text-xs text-primary/40 mt-0.5">
              Top up to post more tasks
            </p>
          </div>
          <span className="material-symbols-outlined text-primary/20 group-hover:text-secondary transition-colors">
            arrow_forward
          </span>
        </Link>
        <Link
          href="/buyer/tasks/new"
          className="flex items-center gap-4 bg-white rounded-2xl border border-primary/5 shadow-sm p-5 hover:border-secondary/20 hover:shadow-md transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors shrink-0">
            <span className="material-symbols-outlined text-secondary text-xl">
              add_circle
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-primary text-sm">Post a Task</p>
            <p className="text-xs text-primary/40 mt-0.5">Get work done fast</p>
          </div>
          <span className="material-symbols-outlined text-primary/20 group-hover:text-secondary transition-colors">
            arrow_forward
          </span>
        </Link>
      </div>
    </div>
  );
}
