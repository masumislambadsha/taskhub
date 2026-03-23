"use client";
import { useState } from "react";
import Link from "next/link";

const FAQ_CATEGORIES = [
  {
    label: "Getting Started",
    icon: "rocket_launch",
    color: "bg-blue-50 text-blue-700",
    desc: "New here? Start with the basics.",
    items: [
      {
        q: "How do I create an account?",
        a: "Click 'Sign up' in the top navigation, choose your role (Worker or Buyer), fill in your details, and you're in. Workers start with 10 free coins; buyers start with 50 coins to try the platform.",
      },
      {
        q: "What is the difference between a Worker and a Buyer?",
        a: "Buyers post tasks and fund them with coins. Workers browse available tasks, complete them, and earn coins that can be withdrawn as real cash. You can only hold one role per account.",
      },
      {
        q: "Is TaskHub free to join?",
        a: "Yes, registration is completely free for both workers and buyers. Buyers purchase coins to fund tasks; workers earn coins by completing them. There are no monthly fees or subscriptions.",
      },
      {
        q: "What countries are supported?",
        a: "TaskHub is available globally. Payment methods vary by region — Stripe is available internationally, while bKash and SSLCommerz serve Bangladesh specifically.",
      },
      {
        q: "Can I change my role after signing up?",
        a: "No, your role is set at registration. If you need a different role, you will need to create a separate account with a different email address.",
      },
    ],
  },
  {
    label: "For Workers",
    icon: "engineering",
    color: "bg-green-50 text-green-700",
    desc: "Everything about completing tasks and earning.",
    items: [
      {
        q: "How do I find and complete tasks?",
        a: "Go to Worker Dashboard and click Browse Tasks. Filter by category, payout, or deadline. Click a task to read the full instructions, then submit your proof of completion before the deadline.",
      },
      {
        q: "How do I withdraw my earnings?",
        a: "You need at least 200 coins to request a withdrawal. Go to Worker → Withdrawals, enter the amount, choose your payment method (bKash or SSLCommerz), and submit. Admin processes it within 24 hours on business days.",
      },
      {
        q: "What is the coin withdrawal rate?",
        a: "Workers withdraw at a rate of 20 coins = $1 USD. So 200 coins = $10, 500 coins = $25, 1000 coins = $50, and so on. There are no additional withdrawal fees.",
      },
      {
        q: "What happens if my submission is rejected?",
        a: "You will not earn coins for rejected submissions. The buyer may leave feedback explaining why. Review it carefully and apply those learnings to future tasks. Repeated rejections may affect your standing on the platform.",
      },
      {
        q: "Is there a limit to how much I can earn?",
        a: "No limit at all. The more tasks you complete with high approval rates, the more you earn. Top workers on TaskHub earn thousands of dollars monthly by staying consistent and delivering quality work.",
      },
      {
        q: "Can I submit to the same task multiple times?",
        a: "No. Each worker can only submit once per task. Make sure your submission is complete, accurate, and follows the instructions exactly before hitting submit — you cannot revise it afterward.",
      },
      {
        q: "How do I improve my approval rate?",
        a: "Read task instructions thoroughly before starting. Submit exactly what is asked — no more, no less. Include clear screenshots or evidence. If instructions are unclear, check if the buyer has added notes in the task details.",
      },
    ],
  },
  {
    label: "For Buyers",
    icon: "business_center",
    color: "bg-amber-50 text-amber-700",
    desc: "Posting tasks and managing submissions.",
    items: [
      {
        q: "How do I post a task?",
        a: "Go to Buyer Dashboard and click Post Task. Fill in the title, description, payout per worker, number of workers needed, deadline, and submission instructions. Make sure you have enough coins in your balance to fund the task before posting.",
      },
      {
        q: "How do I buy coins?",
        a: "Go to Buyer → Buy Coins. Choose a package ranging from $1 (10 coins) to $35 (1000 coins) and pay via Stripe, bKash, or SSLCommerz. Coins are credited to your account instantly after payment.",
      },
      {
        q: "What is the coin purchase rate?",
        a: "Buyers purchase at 10 coins = $1 USD. Packages range from $1 (10 coins) to $35 (1000 coins). Larger packages offer better value per coin.",
      },
      {
        q: "How do I review and approve submissions?",
        a: "Go to Buyer → Review Submissions. You will see all pending submissions for your tasks. Click any submission to view the worker's proof, then approve or reject it with optional feedback. You have 3 days to respond before coins auto-release.",
      },
      {
        q: "What happens to my coins if I reject a submission?",
        a: "Coins are only deducted from your balance when you approve a submission. Rejected submissions cost you nothing — your coins remain in your balance and can be used for other tasks.",
      },
      {
        q: "Can I edit or close a task after posting?",
        a: "Yes. Go to Buyer → My Tasks and click Edit on any active task. You can update the description, deadline, or status. Set the status to Closed to stop accepting new submissions while keeping existing ones for review.",
      },
    ],
  },
  {
    label: "Payments & Security",
    icon: "shield",
    color: "bg-purple-50 text-purple-700",
    desc: "Coins, withdrawals, and keeping your account safe.",
    items: [
      {
        q: "Is my payment information secure?",
        a: "Yes. All payments are processed through trusted gateways (Stripe, bKash, SSLCommerz). We never store your full card details on our servers. All transactions are encrypted end-to-end using HTTPS/TLS.",
      },
      {
        q: "How long do withdrawals take?",
        a: "Withdrawal requests are reviewed by our admin team and processed within 24 hours on business days. You will receive a notification once your withdrawal has been approved and sent.",
      },
      {
        q: "Are there any hidden fees?",
        a: "No hidden fees. The platform fee is built into the coin exchange rate spread — buyers buy at 10 coins/$1, workers withdraw at 20 coins/$1. What you see is what you get.",
      },
      {
        q: "What if I have a payment dispute?",
        a: "Contact our support team through the Support Hub with your transaction reference number and a description of the issue. We investigate all payment disputes within 48 hours and aim to resolve them fairly.",
      },
      {
        q: "Can I get a refund on purchased coins?",
        a: "All coin purchases are final and non-refundable as stated in our Terms of Service. If you believe a charge was made in error, contact support immediately with your payment receipt.",
      },
    ],
  },
];

export default function FaqPage() {
  const [activeCategory, setActiveCategory] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  const cat = FAQ_CATEGORIES[activeCategory];

  return (
    <main className="pb-15 md:pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-15 md:py-20 px-4 md:px-8">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Help Center
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none mb-4">
            Got questions?
            <br />
            <span className="text-secondary">We have answers.</span>
          </h1>
          <p className="text-white/50 text-sm mt-4 max-w-xl mx-auto leading-relaxed">
            Everything you need to know about TaskHub. Can&apos;t find what
            you&apos;re looking for?{" "}
            <Link
              href="/support"
              className="text-secondary font-semibold hover:underline"
            >
              Contact support.
            </Link>
          </p>
        </div>
      </section>

      {/* Category cards */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {FAQ_CATEGORIES.map((c, i) => (
            <button
              key={c.label}
              onClick={() => {
                setActiveCategory(i);
                setOpen(null);
              }}
              className={`text-left rounded-2xl border shadow-md p-3 sm:p-5 transition-all ${
                activeCategory === i
                  ? "bg-primary border-primary shadow-lg"
                  : "bg-white border-primary/5 hover:border-secondary/20 hover:shadow-md"
              }`}
            >
              <span
                className={`material-symbols-outlined text-2xl mb-2 block ${activeCategory === i ? "text-secondary" : "text-secondary"}`}
              >
                {c.icon}
              </span>
              <p
                className={`font-headline text-sm font-extrabold ${activeCategory === i ? "text-white" : "text-primary"}`}
              >
                {c.label}
              </p>
              <p
                className={`text-[11px] mt-1 leading-snug ${activeCategory === i ? "text-white/50" : "text-primary/40"}`}
              >
                {c.desc}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Questions */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 mt-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-base">
              {cat.icon}
            </span>
          </div>
          <h2 className="font-headline font-bold text-primary">{cat.label}</h2>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.color}`}
          >
            {cat.items.length} questions
          </span>
        </div>

        <div className="space-y-3">
          {cat.items.map((f, i) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${
                open === i
                  ? "border-secondary/20 shadow-md"
                  : "border-primary/5"
              }`}
            >
              <button
                className="flex justify-between items-center w-full text-left px-4 sm:px-7 py-5 gap-4"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-headline transition-colors duration-200 ${
                      open === i
                        ? "bg-secondary text-white"
                        : "bg-secondary/10 text-secondary"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-bold text-primary text-sm">{f.q}</span>
                </div>
                <span
                  className="material-symbols-outlined text-primary/30 shrink-0 transition-transform duration-300"
                  style={{ transform: open === i ? "rotate(180deg)" : "none" }}
                >
                  expand_more
                </span>
              </button>
              {open === i && (
                <div className="px-4 sm:px-7 pb-6 sm:pl-19 border-t border-primary/5">
                  <p className="text-primary/60 text-sm leading-relaxed pt-4">
                    {f.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 mt-16">
        <div className="bg-primary rounded-3xl p-7 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="font-headline text-2xl font-extrabold text-white mb-2">
              Still have questions?
            </h3>
            <p className="text-white/50 text-sm max-w-md leading-relaxed">
              Our support team is ready to help. You can also check the How It
              Works page for a full walkthrough of the platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/support"
              className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-secondary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                support_agent
              </span>
              Contact Support
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">help</span>
              How It Works
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
