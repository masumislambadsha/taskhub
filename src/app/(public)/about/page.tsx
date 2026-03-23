import Link from "next/link";

const STATS = [
  { value: "10K+", label: "Tasks Completed", icon: "task_alt" },
  { value: "3K+", label: "Active Workers", icon: "engineering" },
  { value: "500+", label: "Buyers Onboard", icon: "business_center" },
  { value: "24h", label: "Avg. Payout Time", icon: "schedule" },
];

const VALUES = [
  {
    icon: "verified",
    title: "Trust by Design",
    desc: "Every submission goes through a human review. Buyers approve work before coins move — no disputes, no surprises.",
  },
  {
    icon: "bolt",
    title: "Speed & Simplicity",
    desc: "Post a task in under two minutes. Workers find it instantly. The whole loop — post, complete, pay — is frictionless.",
  },
  {
    icon: "public",
    title: "Global Access",
    desc: "Workers and buyers from anywhere in the world. Multiple payment gateways mean no one gets left out.",
  },
  {
    icon: "trending_up",
    title: "Real Earnings",
    desc: "No surveys, no points that expire. Workers earn coins redeemable for real cash, withdrawn directly to their account.",
  },
];

const TIMELINE = [
  {
    year: "Idea",
    title: "The Problem",
    desc: "Freelance platforms charge high fees and require long commitments. Small tasks needed a lighter, faster solution.",
  },
  {
    year: "Build",
    title: "The Platform",
    desc: "Built with Next.js 15, TypeScript, MongoDB, and NextAuth — a production-grade SaaS with role-based access and a coin economy.",
  },
  {
    year: "Launch",
    title: "The Ecosystem",
    desc: "Three roles, one platform. Admins manage quality. Buyers fund tasks. Workers earn. Everyone wins.",
  },
  {
    year: "Now",
    title: "Growing Fast",
    desc: "Thousands of tasks completed, real money earned, and a community of workers and buyers that keeps expanding.",
  },
];

const TECH = [
  { name: "Next.js 15", icon: "code" },
  { name: "TypeScript", icon: "data_object" },
  { name: "MongoDB", icon: "storage" },
  { name: "NextAuth.js", icon: "lock" },
  { name: "Tailwind CSS", icon: "palette" },
  { name: "Stripe / bKash", icon: "payments" },
];

export default function AboutPage() {
  return (
    <main className="pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-16 sm:py-24 px-4 sm:px-8">
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Our Story
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-7xl font-extrabold text-white tracking-tighter leading-none mb-6">
            Work smarter.
            <br />
            <span className="text-secondary">Earn faster.</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-lg max-w-2xl mx-auto leading-relaxed">
            TaskHub is a micro-task marketplace that connects people who need
            small jobs done with skilled workers ready to earn real money — no
            long contracts, no hidden fees, no friction.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
            <Link
              href="/register"
              className="bg-secondary text-white sm:px-7 px-4 py-3  rounded-lg font-bold text-sm hover:bg-secondary/90 transition-colors"
            >
              Start Earning
            </Link>
            <Link
              href="/how-it-works"
              className="bg-white/10 text-white sm:px-7 px-4 py-3 rounded-lg font-bold text-sm hover:bg-white/20 transition-colors"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-6 sm:-mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-primary/5 shadow-md p-6 text-center"
            >
              <span className="material-symbols-outlined text-secondary text-2xl mb-2 block">
                {s.icon}
              </span>
              <p className="font-headline text-[26px] sm:text-3xl font-extrabold text-primary">
                {s.value}
              </p>
              <p className="text-[10px] sm:text-xs text-primary/50 mt-1 font-medium">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-15 sm:mt-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <span className="inline-block bg-secondary/10 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
            Mission
          </span>
          <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-primary tracking-tighter mb-5">
            Democratising online work, one task at a time.
          </h2>
          <p className="text-primary/60 leading-relaxed mb-4">
            We built TaskHub because the gig economy was broken for small tasks.
            Platforms charged 20% fees, required lengthy profiles, and made
            simple jobs feel like applying for a mortgage.
          </p>
          <p className="text-primary/60 leading-relaxed">
            Our answer: a clean coin economy, instant task discovery, and a
            transparent review system that keeps both sides accountable. Buyers
            only pay for approved work. Workers get paid fast.
          </p>
        </div>
        <div className="relative h-72 hidden md:block">
          <div className="absolute inset-0 bg-secondary/5 rounded-3xl rotate-3" />
          <div className="absolute inset-0 bg-primary/5 rounded-3xl -rotate-2" />
          <div className="absolute inset-0 bg-white rounded-3xl border border-primary/10 shadow-lg flex flex-col justify-center items-center gap-4 p-8">
            <span className="material-symbols-outlined text-secondary text-5xl">
              handshake
            </span>
            <p className="font-headline text-xl font-bold text-primary text-center">
              Fair for workers.
              <br />
              Efficient for buyers.
            </p>
            <p className="text-xs text-primary/40 text-center">
              Coins only move when work is approved.
            </p>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-16 sm:mt-20">
        <div className="text-center mb-10 sm:mb-12">
          <span className="inline-block bg-amber-100 text-amber-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
            What We Stand For
          </span>
          <h2 className="font-headline text-[26.5px] sm:text-4xl font-extrabold text-primary tracking-tighter">
            Built on four principles
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          {VALUES.map((v, i) => (
            <div
              key={v.title}
              className="group bg-white rounded-2xl border border-primary/5 shadow-sm p-4 sm:p-7 hover:shadow-md hover:border-secondary/20 transition-all"
            >
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                  <span className="material-symbols-outlined text-secondary text-xl">
                    {v.icon}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-primary/30 font-headline">
                      0{i + 1}
                    </span>
                    <h3 className="font-bold text-primary">{v.title}</h3>
                  </div>
                  <p className="text-[12px] sm:text-sm text-primary/60 leading-relaxed">
                    {v.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-16 sm:mt-24">
        <div className="text-center mb-10 sm:mb-12">
          <span className="inline-block bg-primary/10 text-primary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
            The Journey
          </span>
          <h2 className="font-headline text-3xl sm:text-4xl font-extrabold text-primary tracking-tighter">
            From idea to platform
          </h2>
        </div>
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-primary/10 hidden md:block" />
          <div className="space-y-6 sm:space-y-8">
            {TIMELINE.map((t) => (
              <div key={t.year} className="flex gap-4 sm:gap-8 items-start">
                <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary flex items-center justify-center z-10 shadow-md">
                  <span className="text-[8px] font-extrabold text-white/90 font-headline uppercase">
                    {t.year}
                  </span>
                </div>
                <div className="bg-white rounded-2xl border border-primary/5 shadow-sm p-5 sm:p-6 flex-1">
                  <h3 className="font-bold text-primary mb-1">{t.title}</h3>
                  <p className="text-xs sm:text-sm text-primary/60 leading-relaxed">
                    {t.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-16 sm:mt-24">
        <div className="bg-primary rounded-3xl p-5 sm:p-10 md:p-14">
          <div className="text-center mb-10">
            <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
              Under the Hood
            </span>
            <h2 className="font-headline text-3xl font-extrabold text-white tracking-tighter">
              Built with modern tech
            </h2>
            <p className="text-white/50 text-sm mt-2">
              Production-grade stack, portfolio-quality code.
            </p>
          </div>
          <div className="flex flex-col sm:grid sm:grid-cols-3 gap-4">
            {TECH.map((t) => (
              <div
                key={t.name}
                className="flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-colors rounded-xl px-5 py-4"
              >
                <span className="material-symbols-outlined text-secondary text-xl">
                  {t.icon}
                </span>
                <span className="text-white font-semibold text-sm">
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-10 sm:mt-16">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-secondary/10 rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 block">
                engineering
              </span>
              <h3 className="font-headline text-xl font-bold text-primary mb-2">
                Ready to earn?
              </h3>
              <p className="text-sm text-primary/60 leading-relaxed">
                Browse hundreds of tasks, complete them on your schedule, and
                withdraw real cash whenever you want.
              </p>
            </div>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-secondary/90 transition-colors w-fit"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
              Join as Worker
            </Link>
          </div>
          <div className="bg-primary rounded-2xl p-8 flex flex-col justify-between">
            <div>
              <span className="material-symbols-outlined text-secondary text-3xl mb-4 block">
                business_center
              </span>
              <h3 className="font-headline text-xl font-bold text-white mb-2">
                Need tasks done?
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Post a task in minutes, set your budget, and get results from
                real workers — only pay when you approve.
              </p>
            </div>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-white/20 transition-colors w-fit"
            >
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
              Post a Task
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
