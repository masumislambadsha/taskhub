"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface Props {
  name: string;
  email: string;
  image: string | null;
  level: string;
  isTop: boolean;
}

export default function WorkerProfileClient({
  name,
  email,
  image,
  level,
  isTop,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(image);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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
        const uploadData = await uploadRes.json();
        uploadedUrl = uploadData.url;
      }

      const res = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nameRef.current?.value ?? name,
          ...(uploadedUrl && { image: uploadedUrl }),
        }),
      });

      if (!res.ok) throw new Error("Failed to save profile");

      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Left col — always visible */}
      <div className="lg:col-span-4 flex flex-col items-center lg:items-start">
        <div className="relative mb-6">
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt="Profile"
              width={192}
              height={192}
              className="w-48 h-48 rounded-2xl object-cover shadow-[0_24px_40px_-15px_rgba(11,30,38,0.12)] border-4 border-white"
              unoptimized={previewUrl.startsWith("blob:")}
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
              verified
            </span>
          </div>
        </div>

        <h1 className="font-headline text-4xl font-extrabold text-primary tracking-tight mb-2 text-center lg:text-left">
          {name}
        </h1>
        <p className="font-body text-on-surface-variant text-sm mb-6 text-center lg:text-left">
          {email}
        </p>

        <div className="flex gap-2 flex-wrap mb-6 justify-center lg:justify-start">
          <span className="bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest">
            {level}
          </span>
          {isTop && (
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-label uppercase tracking-widest">
              Top 1%
            </span>
          )}
        </div>

        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 text-sm font-semibold text-secondary hover:underline"
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit Profile
          </button>
        )}
      </div>

      {/* Edit form — full-width row, stats stay above */}
      {editing && (
        <div className="lg:col-span-12 bg-surface-container-lowest rounded-2xl p-6 shadow-[0_24px_40px_-15px_rgba(11,30,38,0.06)]">
          {error && <p className="text-red-500 text-xs mb-4">{error}</p>}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Full Name
              </label>
              <input
                ref={nameRef}
                type="text"
                defaultValue={name}
                className="border border-primary/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background w-44"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Email
              </label>
              <input
                type="email"
                defaultValue={email}
                disabled
                className="border border-primary/10 rounded-xl px-4 py-2.5 text-sm bg-surface-container text-on-surface-variant cursor-not-allowed w-52"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">
                Photo
              </label>
              <label className="flex items-center gap-2 border border-primary/10 rounded-xl px-4 py-2.5 text-sm bg-background cursor-pointer hover:bg-surface-container transition-colors w-40">
                <span className="material-symbols-outlined text-sm text-secondary">
                  upload
                </span>
                <span className="text-on-surface-variant text-xs truncate">
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
                "Save"
              )}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelectedFile(null);
                setPreviewUrl(image);
                setError(null);
              }}
              className="px-3 py-2.5 rounded-xl font-semibold text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
