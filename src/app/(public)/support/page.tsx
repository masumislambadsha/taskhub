"use client";

import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  {
    icon: "payments",
    label: "Payments & Billing",
    desc: "Coins, withdrawals, and transactions",
    color: "bg-green-50 text-green-700",
  },
  {
    icon: "assignment",
    label: "Tasks & Submissions",
    desc: "How to find and complete tasks",
    color: "bg-blue-50 text-blue-700",
  },
  {
    icon: "account_circle",
    label: "Account & Profile",
    desc: "Settings, verification, and security",
    color: "bg-purple-50 text-purple-700",
  },
  {
    icon: "gavel",
    label: "Disputes",
    desc: "Resolve issues with buyers or workers",
    color: "bg-red-50 text-red-700",
  },
  {
    icon: "business_center",
    label: "For Buyers",
    desc: "Posting tasks and managing workers",
    color: "bg-amber-50 text-amber-700",
  },
  {
    icon: "bug_report",
    label: "Technical Support",
    desc: "Bugs, errors, and platform issues",
    color: "bg-slate-100 text-slate-700",
  },
];

const FAQS = [
  {
    q: "How do I get started as a worker?",
    a: "Register an account, select the Worker role, and you will receive 10 starter coins. Browse available tasks, read the instructions carefully, and start submitting. Coins are credited instantly when a buyer approves your work.",
  },
  {
    q: "How does the coin system work?",
    a: "Buyers purchase coins to fund tasks (10 coins = $1). Workers earn coins by completing approved tasks and can withdraw them as cash (20 coins = $1). The spread is how TaskHub earns — no hidden fees.",
  },
  {
    q: "When do I get paid?",
    a: "Coins are credited to your account immediately when a buyer approves your submission. You can request a cash withdrawal anytime you have 200 or more coins in your balance.",
  },
  {
    q: "What happens if my submission is rejected?",
    a: "You will not earn coins for rejected submissions. The buyer may leave feedback — read it carefully and apply those learnings to future tasks.",
  },
  {
    q: "Is there a minimum withdrawal amount?",
    a: "Yes, the minimum withdrawal is 200 coins ($10 USD). Withdrawals are processed within 24 hours on business days via bKash or SSLCommerz.",
  },
  {
    q: "How do I contact a buyer about a task?",
    a: "Use the Messages Hub in your worker dashboard to communicate with buyers about task requirements or submission feedback.",
  },
];

const CONTACT_INFO = [
  {
    icon: "schedule",
    label: "Response Time",
    value: "Within 24 hours on business days",
  },
  {
    icon: "language",
    label: "Languages",
    value: "English & Bengali supported",
  },
  {
    icon: "verified_user",
    label: "Secure",
    value: "All messages are encrypted",
  },
];

const USEFUL_LINKS = [
  { href: "/how-it-works", icon: "help", label: "How It Works" },
  { href: "/terms", icon: "gavel", label: "Terms of Service" },
  { href: "/privacy", icon: "privacy_tip", label: "Privacy Policy" },
  { href: "/faq", icon: "quiz", label: "Full FAQ" },
];

export default function SupportPage() {
  const [open, setOpen] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    category: "",
    message: "",
  });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <main className="pb-15 sm:pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-16 sm:py-20 px-4 sm:px-8">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Support Hub
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none mb-4">
            How can we
            <br />
            <span className="text-secondary">help you?</span>
          </h1>
          <p className="text-white/50 text-sm mt-4 max-w-xl mx-auto leading-relaxed">
            Browse by category, check the FAQ, or send us a message. We aim to
            respond within 24 hours on business days.
          </p>
        </div>
      </section>

      {/* Info bar */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {CONTACT_INFO.map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-2xl border border-primary/5 shadow-md p-5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary text-xl">
                  {c.icon}
                </span>
              </div>
              <div>
                <p className="font-bold text-primary text-sm">{c.label}</p>
                <p className="text-[11px] text-primary/40 mt-0.5">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-14">
        <div className="mb-6">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Browse
          </span>
          <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tighter">
            Support categories
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              className="group bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all p-6 cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary group-hover:bg-secondary transition-colors flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary group-hover:text-white text-lg transition-colors">
                    {c.icon}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-primary text-sm">{c.label}</p>
                  <p className="text-[11px] text-primary/40 mt-0.5 leading-snug">
                    {c.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ accordion */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 mt-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              Quick Answers
            </span>
            <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tighter">
              Common questions
            </h2>
          </div>
          <Link
            href="/faq"
            className="text-[13px] sm:text-sm text-secondary font-semibold hover:underline flex items-center gap-1"
          >
            View all FAQs
            <span className="material-symbols-outlined text-sm">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${open === i ? "border-secondary/20 shadow-md" : "border-primary/5"}`}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex justify-between items-center w-full text-left px-7 py-5 gap-4"
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-headline transition-colors ${open === i ? "bg-secondary text-white" : "bg-secondary/10 text-secondary"}`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-bold text-primary text-sm">
                    {faq.q}
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-primary/30 shrink-0 transition-transform duration-300"
                  style={{ transform: open === i ? "rotate(180deg)" : "none" }}
                >
                  expand_more
                </span>
              </button>
              {open === i && (
                <div className="px-7 pb-6 border-t border-primary/5">
                  <p className="text-primary/60 text-xs sm:text-sm leading-relaxed pt-4">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Contact form + sidebar */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-14">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Form */}
          <div className="md:col-span-3">
            <div className="mb-6">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                Get in Touch
              </span>
              <h2 className="font-headline text-2xl font-extrabold text-primary tracking-tighter">
                Send us a message
              </h2>
            </div>

            {sent ? (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center">
                <span className="material-symbols-outlined text-green-500 text-5xl mb-4 block">
                  check_circle
                </span>
                <p className="font-bold text-primary mb-1">Message sent!</p>
                <p className="text-sm text-primary/60">
                  We will get back to you within 24 hours on business days.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setForm({ name: "", email: "", category: "", message: "" });
                  }}
                  className="mt-6 text-sm text-secondary font-semibold hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl border border-primary/5 shadow-sm p-7 space-y-5"
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                      Name
                    </label>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Your name"
                      className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="your@email.com"
                      className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                    Category
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 transition text-primary bg-white"
                  >
                    <option value="">Select a category...</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-primary/50 mb-2">
                    Message
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                    placeholder="Describe your issue in detail..."
                    className="w-full border border-primary/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/30 resize-none transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    send
                  </span>
                  Send Message
                </button>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <div className="md:col-span-2 space-y-5">
            <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6">
              <span className="material-symbols-outlined text-secondary text-2xl mb-3 block">
                tips_and_updates
              </span>
              <p className="font-bold text-primary mb-2 text-lg">
                Before you write
              </p>
              <p className="text-xs sm:text-sm text-primary/60 leading-relaxed">
                Check the FAQ page first — most common questions are answered
                there instantly, no waiting required.
              </p>
              <Link
                href="/faq"
                className="inline-flex items-center gap-1 mt-4 text-sm text-secondary font-semibold hover:underline"
              >
                Browse FAQ
                <span className="material-symbols-outlined text-sm">
                  arrow_forward
                </span>
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 space-y-4">
              <p className="font-bold text-primary text-sm">Useful links</p>
              {USEFUL_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-center gap-3 text-sm text-primary/60 hover:text-primary transition-colors group"
                >
                  <span className="material-symbols-outlined text-secondary text-base">
                    {l.icon}
                  </span>
                  {l.label}
                  <span className="material-symbols-outlined text-primary/20 text-sm ml-auto group-hover:text-secondary transition-colors">
                    arrow_forward
                  </span>
                </Link>
              ))}
            </div>

            <div className="bg-primary rounded-2xl p-6">
              <span className="material-symbols-outlined text-secondary text-2xl mb-3 block">
                schedule
              </span>
              <p className="font-bold text-white text-sm mb-1">Response time</p>
              <p className="text-white/50 text-xs sm:text-sm leading-relaxed">
                We typically respond within 24 hours on business days. Urgent
                payment issues are prioritized.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
