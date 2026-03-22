"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, RegisterFormData } from "@/lib/validators/auth";
import Link from "next/link";
import toast from "react-hot-toast";
import axios from "axios";

const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const Divider = ({ label = "or" }: { label?: string }) => (
  <div className="relative my-5">
    <div className="absolute inset-0 flex items-center">
      <div className="w-full border-t border-primary/10" />
    </div>
    <div className="relative flex justify-center">
      <span className="bg-white px-3 text-xs text-primary/40">{label}</span>
    </div>
  </div>
);

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(params.get("role") ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: (params.get("role") as "worker" | "buyer") || "worker",
    },
  });

  const role = watch("role");

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/worker/dashboard" });
  }

  async function handleImageUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await axios.post("/api/v1/uploads/imgbb", formData);
      const url: string = res.data.url;
      setValue("photoUrl", url);
      setPreview(url);
      toast.success("Photo uploaded!");
    } catch {
      toast.error("Upload failed. You can paste a URL instead.");
      URL.revokeObjectURL(localUrl);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(data: RegisterFormData) {
    setLoading(true);
    try {
      await axios.post("/api/v1/auth/register", data);
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (res?.error) throw new Error("Login failed after registration");
      toast.success("Welcome to TaskHub!");
      router.push(
        data.role === "buyer" ? "/buyer/dashboard" : "/worker/dashboard",
      );
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Registration failed";
      toast.error(typeof msg === "string" ? msg : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  if (step === 1) {
    return (
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-primary/5 p-8">
          <h1 className="font-headline text-2xl font-bold text-primary mb-2">
            Join TaskHub
          </h1>
          <p className="text-primary/60 text-sm mb-8">
            How would you like to use TaskHub?
          </p>
          <div className="grid grid-cols-2 gap-4 mb-6">
            {(["worker", "buyer"] as const).map((r) => (
              <button
                key={r}
                onClick={() => {
                  setValue("role", r);
                  setStep(2);
                }}
                className={`p-6 rounded-xl border-2 text-center transition-all ${role === r ? "border-secondary bg-secondary/5" : "border-primary/10 hover:border-secondary/50"}`}
              >
                <span className="material-symbols-outlined text-3xl text-secondary mb-2 block">
                  {r === "worker" ? "work" : "business_center"}
                </span>
                <div className="font-bold text-primary capitalize">{r}</div>
                <div className="text-xs text-primary/50 mt-1">
                  {r === "worker"
                    ? "Complete tasks & earn"
                    : "Post tasks & get work done"}
                </div>
              </button>
            ))}
          </div>

          <Divider label="or sign up with" />

          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 border border-primary/20 py-3 rounded-lg font-medium text-primary hover:bg-primary/5 transition-colors"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="text-center text-sm text-primary/60 mt-5">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-secondary font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl border border-primary/5 p-8">
        <button
          onClick={() => setStep(1)}
          className="flex items-center gap-1 text-sm text-primary/50 hover:text-primary mb-6"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>{" "}
          Back
        </button>
        <h1 className="font-headline text-2xl font-bold text-primary mb-1">
          Create your account
        </h1>
        <p className="text-primary/60 text-sm mb-6">
          Signing up as a{" "}
          <span className="font-semibold text-secondary capitalize">
            {role}
          </span>
        </p>

        <button
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-3 border border-primary/20 py-3 rounded-lg font-medium text-primary hover:bg-primary/5 transition-colors mb-2"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <Divider label="or fill in your details" />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Profile photo */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Profile Photo <span className="text-primary/40">(optional)</span>
            </label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-primary/20 bg-background flex items-center justify-center cursor-pointer hover:border-secondary transition-colors overflow-hidden shrink-0 group"
              >
                {preview ? (
                  <>
                    <img
                      src={preview}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-xl">
                        edit
                      </span>
                    </div>
                  </>
                ) : uploading ? (
                  <div className="w-6 h-6 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-primary/30 text-3xl">
                    add_a_photo
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full px-4 py-2.5 rounded-lg border border-primary/20 bg-background text-sm text-primary hover:border-secondary transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    upload
                  </span>
                  {uploading ? "Uploading…" : "Upload image"}
                </button>
                <p className="text-xs text-primary/40 text-center">
                  or paste a URL below
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }}
              />
            </div>
            <input
              {...register("photoUrl")}
              type="url"
              className="mt-2 w-full px-4 py-2.5 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary text-sm"
              placeholder="https://..."
              onChange={(e) => {
                register("photoUrl").onChange(e);
                setPreview(e.target.value || null);
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Full Name
            </label>
            <input
              {...register("name")}
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="Your name"
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Email
            </label>
            <input
              {...register("email")}
              type="email"
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="you@example.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Password
            </label>
            <input
              {...register("password")}
              type="password"
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="Min 6 characters"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-1.5">
              Confirm Password
            </label>
            <input
              {...register("confirmPassword")}
              type="password"
              className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
              placeholder="Repeat password"
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60 mt-2"
          >
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-primary/60 mt-5">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-secondary font-semibold hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
