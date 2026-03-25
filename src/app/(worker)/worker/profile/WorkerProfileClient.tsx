"use client";
import {
  MdAccountCircle,
  MdCheck,
  MdEdit,
  MdRefresh,
  MdUpload,
  MdVerified,
} from "react-icons/md";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

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
  const { update } = useSession();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(image);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [currentName, setCurrentName] = useState(name);

  // Sync internal name if prop changes (e.g. on router.refresh)
  useEffect(() => {
    setCurrentName(name);
  }, [name]);

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
      }
      const newName = nameRef.current?.value ?? name;
      const res = await fetch("/api/v1/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          ...(uploadedUrl && { image: uploadedUrl }),
        }),
      });
      if (!res.ok) throw new Error("Failed to save profile");

      await update({ name: newName, image: uploadedUrl ?? image });
      router.refresh();

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
    <div className="lg:col-span-4 flex flex-col gap-4">
      <div className="bg-primary rounded-xl p-6 flex flex-col items-center text-center relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-secondary/10 pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative mb-4 z-10">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Profile"
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white/20"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/10 ring-4 ring-white/20 flex items-center justify-center">
              <MdAccountCircle
                className="text-white/50"
                style={{ fontSize: 48 }}
              />
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 bg-secondary w-7 h-7 rounded-full flex items-center justify-center shadow-lg">
            <MdVerified className="text-white text-sm" />
          </div>
        </div>
        <h1 className="font-headline text-xl font-extrabold text-white tracking-tight z-10">
          {currentName}
        </h1>
        <p className="text-white/50 text-xs mt-1 z-10">{email}</p>
        <div className="flex gap-2 flex-wrap justify-center mt-3 z-10">
          <span className="bg-secondary/20 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
            {level}
          </span>
          {isTop && (
            <span className="bg-amber-400/20 text-amber-300 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              Top 1%
            </span>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="mt-5 z-10 flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors"
          >
            <MdEdit className="text-sm" />
            Edit Profile
          </button>
        )}
      </div>

      {editing && (
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-5">
          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}
          <h3 className="font-bold text-primary text-sm mb-4">Edit Profile</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-primary/60 mb-1">
                Full Name
              </label>
              <input
                ref={nameRef}
                type="text"
                defaultValue={currentName}
                className="w-full border border-primary/15 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 bg-background text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary/60 mb-1">
                Email
              </label>
              <input
                type="email"
                defaultValue={email}
                disabled
                className="w-full border border-primary/10 rounded-lg px-3 py-2.5 text-sm bg-background/60 text-primary/40 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary/60 mb-1">
                Photo
              </label>
              <label className="flex items-center gap-2 border border-primary/15 rounded-lg px-3 py-2.5 text-sm bg-background cursor-pointer hover:bg-primary/5 transition-colors">
                <MdUpload className="text-sm text-secondary" />
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
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <MdRefresh className="text-sm animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <MdCheck className="text-sm" />
                    Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setSelectedFile(null);
                  setPreviewUrl(image);
                  setError(null);
                }}
                className="px-4 py-2.5 rounded-lg font-semibold text-sm text-primary/60 hover:bg-primary/5 transition-colors border border-primary/10"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
