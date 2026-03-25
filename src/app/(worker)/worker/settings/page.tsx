"use client";
import { MdAccountCircle, MdLock, MdVisibility, MdVisibilityOff } from 'react-icons/md';

import { useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";
import toast from "react-hot-toast";
import { IconType } from "react-icons";

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: IconType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-5 border-b border-primary/5 flex items-center gap-3">
        <Icon className="text-secondary text-xl" />
        <div>
          <h2 className="font-bold text-primary text-sm">{title}</h2>
          <p className="text-primary/50 text-xs mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export default function WorkerSettingsPage() {
  const { data: session } = useSession();
  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwLoading, setPwLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (pwForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setPwLoading(true);
    try {
      await axios.post("/api/v1/user/change-password", {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      toast.success("Password updated successfully");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Something went wrong";
      toast.error(typeof msg === "string" ? msg : "Something went wrong");
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Settings
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Manage your account security and preferences.
        </p>
      </div>

      <Section
        icon={MdAccountCircle}
        title="Account Info"
        subtitle="Your current account details"
      >
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-primary/5">
            <span className="text-sm text-primary/60">Name</span>
            <span className="text-sm font-semibold text-primary">
              {session?.user?.name ?? "—"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-primary/5">
            <span className="text-sm text-primary/60">Email</span>
            <span className="text-sm font-semibold text-primary">
              {session?.user?.email ?? "—"}
            </span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-sm text-primary/60">Role</span>
            <span className="text-sm font-semibold text-primary capitalize">
              {session?.user?.role ?? "worker"}
            </span>
          </div>
        </div>
        <p className="text-xs text-primary/40 mt-4">
          To update your name or photo, visit your{" "}
          <a href="/worker/profile" className="text-secondary hover:underline">
            profile page
          </a>
          .
        </p>
      </Section>

      <Section
        icon={MdLock}
        title="Change Password"
        subtitle="Update your login password"
      >
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-primary/60 mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={pwForm.currentPassword}
                onChange={(e) =>
                  setPwForm((p) => ({ ...p, currentPassword: e.target.value }))
                }
                required
                className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 text-sm pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary/40 hover:text-secondary transition-colors"
              >
                {showCurrent ? (
                  <MdVisibilityOff className="text-xl" />
                ) : (
                  <MdVisibility className="text-xl" />
                )}
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-primary/60 mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={pwForm.newPassword}
                  onChange={(e) =>
                    setPwForm((p) => ({ ...p, newPassword: e.target.value }))
                  }
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 text-sm pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-primary/40 hover:text-secondary transition-colors"
                >
                  {showNew ? (
                    <MdVisibilityOff className="text-xl" />
                  ) : (
                    <MdVisibility className="text-xl" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-primary/60 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={pwForm.confirmPassword}
                  onChange={(e) =>
                    setPwForm((p) => ({ ...p, confirmPassword: e.target.value }))
                  }
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary/30 text-sm pr-12"
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
          </div>
          <button
            type="submit"
            disabled={pwLoading}
            className="bg-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {pwLoading ? "Updating…" : "Update Password"}
          </button>
        </form>
      </Section>
    </div>
  );
}
