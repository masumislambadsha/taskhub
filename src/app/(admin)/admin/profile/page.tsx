"use client";
import {
  MdAccountCircle,
  MdCheck,
  MdEdit,
  MdGroup,
  MdRefresh,
  MdToll,
  MdUpload,
  MdVerified,
} from "react-icons/md";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { isDemoAdmin } from "@/lib/roles";

export default function AdminProfilePage() {
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [about, setAbout] = useState("");
  const [stats, setStats] = useState({
    users: 0,
    pendingWithdrawals: 0,
    coinsInCirculation: 0,
  });
  const nameRef = useRef<HTMLInputElement>(null);
  const aboutRef = useRef<HTMLTextAreaElement>(null);

  const displayImage = previewUrl ?? session?.user?.image ?? null;

  useEffect(() => {
    fetch("/api/v1/user/profile")
      .then((r) => r.json())
      .then((d) => setAbout(d.about ?? ""))
      .catch(() => {});
    fetch("/api/v1/admin/stats")
      .then((r) => r.json())
      .then((d) =>
        setStats({
          users: (d.totalWorkers ?? 0) + (d.totalBuyers ?? 0),
          pendingWithdrawals: d.pendingWithdrawals ?? 0,
          coinsInCirculation: d.totalCoins ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      let uploadedUrl: string | null = null;
      if (selectedFile) {
        const fd = new FormData();
        fd.append("image", selectedFile);
        const uploadRes = await fetch("/api/v1/uploads/imgbb", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");
        uploadedUrl = (await uploadRes.json()).url;
        setPreviewUrl(uploadedUrl);
      }
      const res = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameRef.current?.value ?? session?.user?.name,
          about: aboutRef.current?.value ?? about,
          ...(uploadedUrl && { image: uploadedUrl }),
        }),
      });
      if (!res.ok) throw new Error("Failed to save profile");
      setAbout(aboutRef.current?.value ?? about);
      setSaved(true);
      setEditing(false);
      setSelectedFile(null);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-2xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="h-24 bg-primary relative">
          <div className="absolute -bottom-10 left-6 sm:left-8">
            {displayImage ? (
              <img
                src={displayImage}
                alt="Profile"
                className="w-20 h-20 rounded-2xl object-cover border-4 border-white shadow-md"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-secondary/20 border-4 border-white shadow-md flex items-center justify-center">
                <MdAccountCircle className="text-3xl text-primary/30" />
              </div>
            )}
          </div>
        </div>

        <div className="pt-14 pb-6 px-6 sm:px-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline text-2xl font-extrabold text-primary tracking-tight">
                {session?.user?.name ?? "Admin"}
              </h1>
              <span className="bg-secondary/10 text-secondary px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {isDemoAdmin(session?.user?.role) ? "Demo Admin" : "Administrator"}
              </span>
            </div>
            <p className="text-sm text-primary/50 mt-0.5">
              {session?.user?.email}
            </p>
            {about && (
              <p className="text-sm text-primary/60 mt-2 max-w-md">{about}</p>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              disabled={isDemoAdmin(session?.user?.role)}
              title={
                isDemoAdmin(session?.user?.role)
                  ? "Read-only demo: changes are disabled"
                  : undefined
              }
              className="disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold text-secondary hover:underline shrink-0"
            >
              <MdEdit className="text-sm" />
              Edit Profile
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-5">
          <MdGroup className="text-5xl text-primary/15 mb-3 block" />
          <p className="font-headline text-2xl font-extrabold text-primary">
            {stats.users.toLocaleString()}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-primary/40 font-bold mt-1">
            Platform Users
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-5">
          <MdVerified className="text-5xl text-primary/15 mb-3 block" />
          <p className="font-headline text-2xl font-extrabold text-primary">
            {stats.pendingWithdrawals.toLocaleString()}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-primary/40 font-bold mt-1">
            Pending Withdrawals
          </p>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-primary rounded-2xl p-5 flex flex-col justify-between">
          <MdToll className="text-5xl text-white/15 mb-3 block" />
          <p className="font-headline text-2xl font-extrabold text-white">
            {stats.coinsInCirculation.toLocaleString()}
          </p>
          <p className="text-[11px] uppercase tracking-widest text-white/50 font-bold mt-1">
            Coins in Circulation
          </p>
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 sm:p-8">
          <h2 className="font-headline text-lg font-extrabold text-primary mb-6">
            Edit Profile
          </h2>
          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                Full Name
              </label>
              <input
                ref={nameRef}
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
                className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm bg-primary/5 cursor-not-allowed text-primary/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                Photo
              </label>
              <label className="flex items-center gap-2 border border-primary/15 rounded-xl px-4 py-3 text-sm bg-background cursor-pointer hover:bg-primary/5 transition-colors">
                <MdUpload className="text-secondary shrink-0" />
                <span className="text-primary/50 text-xs truncate">
                  {selectedFile ? selectedFile.name : "Upload image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                About
              </label>
              <textarea
                ref={aboutRef}
                rows={4}
                defaultValue={about}
                placeholder="Anything you'd like your profile to reflect…"
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
                  <MdRefresh className="text-sm animate-spin" /> Saving...
                </>
              ) : saved ? (
                <>
                  <MdCheck className="text-sm" /> Saved
                </>
              ) : (
                "Save Changes"
              )}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelectedFile(null);
                setPreviewUrl(null);
                setError(null);
              }}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-primary/50 hover:bg-primary/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}