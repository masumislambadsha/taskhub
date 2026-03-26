import {
  MdAnalytics,
  MdApi,
  MdArrowForward,
  MdAssignment,
  MdAssignmentTurnedIn,
  MdBolt,
  MdCategory,
  MdContactSupport,
  MdDashboard,
  MdExpandMore,
  MdFactCheck,
  MdInfo,
  MdPayments,
  MdPerson,
  MdPostAdd,
  MdRateReview,
  MdSchedule,
  MdSearch,
  MdSpeed,
  MdStar,
  MdToll,
  MdTrendingFlat,
  MdTrendingUp,
  MdVerified,
  MdVerifiedUser,
} from "react-icons/md";
import Link from "next/link";
import MarqueeBrands from "@/components/ui/MarqueeBrands";
import StatsSection from "@/components/ui/StatsSection";
import CountUp from "@/components/ui/CountUp";
import CoinPackageCards from "@/components/ui/CoinPackageCards";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import HomeAnimations from "@/components/HomeAnimations";
import { IconType } from "react-icons";

async function getTopWorkers() {
  try {
    await connectDB();
    return User.find({ role: "worker", status: "active" })
      .sort("-coins")
      .limit(6)
      .select("name photoUrl coins")
      .lean();
  } catch {
    return [];
  }
}

const FALLBACK_WORKERS = [
  { name: "Alex Rodriguez", coins: 12450, approval: "99.2%" },
  { name: "Sarah Chen", coins: 10820, approval: "98.7%" },
  { name: "Priya Sharma", coins: 9450, approval: "100%" },
];

const WORKER_FEATURES: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: MdVerifiedUser,
    title: "Secure Payments",
    desc: "Our escrow system ensures you get paid for every approved task, with instant withdrawals to multiple providers.",
  },
  {
    icon: MdSchedule,
    title: "Total Flexibility",
    desc: "Choose tasks that fit your schedule. No minimum hours, no long-term commitments, just pure execution.",
  },
  {
    icon: MdTrendingUp,
    title: "Skill Progression",
    desc: "Higher ratings unlock higher-paying, exclusive tasks. Build your reputation in the marketplace.",
  },
];

const BUYER_FEATURES: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: MdSpeed,
    title: "Unmatched Speed",
    desc: "Tasks are picked up in seconds. Reach 10,000 completions per day with our distributed workforce.",
  },
  {
    icon: MdFactCheck,
    title: "Quality Assurance",
    desc: "Built-in consensus algorithms and manual audit tools ensure only the highest quality data enters your system.",
  },
  {
    icon: MdApi,
    title: "Full API Access",
    desc: "Automate task creation and result ingestion. Integrate TaskHub directly into your existing data pipelines.",
  },
];

const HOW_WORKERS: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: MdSearch,
    title: "Browse Curated Tasks",
    desc: "Access a personalized feed of micro-tasks that match your skill profile and availability.",
  },
  {
    icon: MdAssignmentTurnedIn,
    title: "Execute & Submit",
    desc: "Follow clear guidelines to complete tasks. Our interface makes documentation seamless.",
  },
  {
    icon: MdPayments,
    title: "Withdraw Earnings",
    desc: "Cash out your coins via Stripe, bKash, or SSLCommerz whenever you want.",
  },
];

const HOW_BUYERS: { icon: IconType; title: string; desc: string }[] = [
  {
    icon: MdPostAdd,
    title: "Define Your Scope",
    desc: "Post tasks with specific requirements, quality thresholds, and target demographics.",
  },
  {
    icon: MdRateReview,
    title: "Review Submissions",
    desc: "Approve or reject worker submissions with one click. Full control over quality.",
  },
  {
    icon: MdAnalytics,
    title: "Scale Operations",
    desc: "Reach thousands of completions per day with our distributed workforce.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How do I withdraw my earnings?",
    a: "You can withdraw your earnings as soon as your balance reaches the minimum threshold of 200 coins. We support bKash and SSLCommerz. Payments are processed within 24 hours.",
    open: true,
  },
  {
    q: "What kind of tasks are available?",
    a: "Tasks range from data labeling, content moderation, surveys, image annotation, writing & reviews, app testing, social media engagement, and research. New task types are added regularly.",
  },
  {
    q: "How does the coin system work?",
    a: "Buyers purchase coins at 10 coins per $1. Workers earn coins by completing approved tasks and can withdraw at a rate of 20 coins per $1. The difference is TaskHub's platform fee.",
  },
  {
    q: "How is quality maintained?",
    a: "We use a combination of buyer review, worker reputation scores, and submission proof requirements to ensure high-quality work. Buyers can reject low-quality submissions.",
  },
  {
    q: "Is there a limit to how much I can earn?",
    a: "No limits. The more tasks you complete with high approval rates, the more you earn. Top workers earn thousands of dollars monthly.",
  },
  {
    q: "How do I get started as a buyer?",
    a: "Register as a buyer, purchase coins, and post your first task in minutes. Set your payout per worker, deadline, and submission requirements — then workers will start submitting.",
  },
  {
    q: "What happens if a submission is rejected?",
    a: "Rejected submissions do not cost the buyer any coins. Workers receive feedback and can improve their approach on future tasks. Repeated low-quality submissions may affect a worker's reputation.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed through trusted gateways. We never store your full card details. Transactions are encrypted end-to-end.",
  },
];

export default async function HomePage() {
  const topWorkers = await getTopWorkers();

  const workerList =
    topWorkers.length > 0
      ? topWorkers.map(
          (w: {
            _id: unknown;
            name: string;
            photoUrl?: string;
            coins: number;
          }) => ({
            key: String(w._id),
            name: w.name,
            coins: w.coins,
            photoUrl: w.photoUrl,
            approval: null,
          }),
        )
      : FALLBACK_WORKERS.map((w) => ({
          key: w.name,
          name: w.name,
          coins: w.coins,
          photoUrl: undefined,
          approval: w.approval,
        }));

  return (
    <>
      <HomeAnimations />


      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 md:py-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center overflow-hidden">
        <div className="space-y-6 min-w-0">
          <h1
            data-gsap="hero-title"
            className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-primary leading-[1.1] tracking-tight"
          >
            Earn from micro tasks or{" "}
            <span className="text-secondary">get work done faster</span>
          </h1>
          <p
            data-gsap="hero-sub"
            className="text-base sm:text-lg md:text-xl text-primary/70 leading-relaxed font-light"
          >
            The premium marketplace for precise execution. Join thousands of
            workers and buyers in a curated ecosystem built for efficiency.
          </p>
          <div
            data-gsap="hero-cta"
            className="flex flex-col sm:flex-row gap-3 pt-2"
          >
            <Link
              href="/register?role=worker"
              className="bg-primary text-white px-7 py-3.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-xl shadow-primary/10 hover:scale-95 transition-transform"
            >
              Start earning
              <MdArrowForward className="text-lg" />
            </Link>
            <Link
              href="/register?role=buyer"
              className="border-2 border-secondary text-primary px-7 py-3.5 rounded-lg font-bold hover:bg-secondary/10 transition-colors text-center"
            >
              Post a task
            </Link>
          </div>
        </div>
        <div
          data-gsap="hero-visual-wrapper"
          className="flex justify-center lg:justify-end"
        >
          <div
            data-gsap="hero-visual"
            className="relative w-full max-w-sm sm:max-w-md lg:max-w-full"
          >
            <div className="absolute -inset-4 bg-secondary/10 rounded-[2rem] blur-2xl" />
            <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-primary/5 aspect-[4/3] flex">
              <div className="w-16 sm:w-20 bg-primary h-full flex flex-col items-center py-6 gap-6">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">T</span>
                </div>
                <div className="space-y-4">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/40 flex items-center justify-center">
                    <MdDashboard className="text-white text-sm" />
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <MdSearch className="text-white/60 text-sm" />
                  </div>
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <MdAssignment className="text-white/60 text-sm" />
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 sm:p-6 bg-slate-50 flex flex-col gap-3 sm:gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-slate-400">Good morning,</p>
                    <p className="text-sm font-semibold text-primary">
                      Alex Johnson
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2 sm:px-4 py-1.5 rounded-full">
                    <MdToll className="text-sm text-amber-500" />
                    <span className="text-sm font-bold text-amber-600">
                      1,240
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Tasks Done</p>
                    <p className="text-lg sm:text-xl font-bold text-primary">
                      38
                    </p>
                    <p className="text-xs text-green-500 mt-0.5">
                      ↑ 4 this week
                    </p>
                  </div>
                  <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border border-slate-100">
                    <p className="text-xs text-slate-400 mb-1">Earned</p>
                    <p className="text-lg sm:text-xl font-bold text-secondary">
                      620{" "}
                      <span className="text-xs font-normal text-slate-400">
                        coins
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">≈ $31.00</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm border-l-4 border-secondary flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-xs font-semibold text-primary">
                      Write a 5-star product review
                    </p>
                    <span className="text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                      +20 coins
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">
                    Take a screenshot of your review and submit proof.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      2 of 50 slots left
                    </span>
                    <button className="text-xs bg-secondary text-white px-4 py-1 rounded-full">
                      Start Task
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="md:py-12 py-5 max-w-7xl px-4 md:px-8 mx-auto  border-y border-primary/5 overflow-hidden">
        <div className=" mb-6">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary/40">
            Trusted by:
          </span>
        </div>
        <MarqueeBrands />
      </section>


      <section
        className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-32 overflow-hidden"
        id="how-it-works"
      >
        <div data-gsap="fade-up" className="text-center mb-10 md:mb-24">
          <h2 className="font-headline text-3xl sm:text-4xl font-bold text-primary mb-4 sm:mb-6">
            Precision Engineering for Every Workflow
          </h2>
          <p className="text-primary/60 max-w-2xl mx-auto text-base sm:text-lg font-light">
            Whether you&apos;re looking to complete micro-tasks or scale your
            operations, TaskHub provides the infrastructure.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 md:gap-16">
          <div className="space-y-4 sm:space-y-6 min-w-0 w-full">
            <div className="flex items-center gap-4">
              <div className="h-0.5 w-12 bg-secondary shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                For Workers
              </span>
            </div>
            {HOW_WORKERS.map((s) => (
              <div
                key={s.title}
                data-gsap="how-card"
                className="bg-white p-5 sm:p-8 rounded-xl shadow-sm border border-primary/5 flex gap-4 sm:gap-6 items-start min-w-0"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                  {(() => {
                    const Icon = s.icon;
                    return <Icon className="text-base sm:text-xl" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2 text-primary">
                    {s.title}
                  </h3>
                  <p className="text-sm text-primary/60 leading-relaxed font-light">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4 sm:space-y-6 min-w-0 w-full">
            <div className="flex items-center gap-4">
              <div className="h-0.5 w-12 bg-primary shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest text-primary">
                For Buyers
              </span>
            </div>
            {HOW_BUYERS.map((s) => (
              <div
                key={s.title}
                data-gsap="how-card"
                className="bg-primary p-5 sm:p-8 rounded-xl shadow-xl shadow-primary/10 text-white flex gap-4 sm:gap-6 items-start min-w-0"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/10 flex items-center justify-center text-secondary shrink-0">
                  {(() => {
                    const Icon = s.icon;
                    return <Icon className="text-base sm:text-xl" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base sm:text-lg mb-1 sm:mb-2">
                    {s.title}
                  </h3>
                  <p className="text-sm text-white/70 leading-relaxed font-light">
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsSection />


      <section className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-32 overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
          <div data-gsap="feature-text" className="lg:w-1/2 w-full min-w-0">
            <div className="inline-block px-4 py-1 bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-widest rounded mb-6">
              Empowering Talent
            </div>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold text-primary mb-6 sm:mb-8">
              Work on your terms, get paid for your precision
            </h2>
            <div className="space-y-7 sm:space-y-10">
              {WORKER_FEATURES.map((f) => (
                <div
                  key={f.title}
                  data-gsap="feature-item"
                  className="flex gap-4 sm:gap-6"
                >
                  {(() => {
                    const Icon = f.icon;
                    return <Icon className="text-secondary mt-1 shrink-0" />;
                  })()}
                  <div className="min-w-0">
                    <h4 className="font-bold text-primary text-lg sm:text-xl mb-1 sm:mb-2">
                      {f.title}
                    </h4>
                    <p className="text-primary/60 font-light text-sm sm:text-base">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div data-gsap="feature-visual" className="lg:w-1/2 w-full min-w-0">
            <div className="bg-white p-5 md:p-10 rounded-2xl shadow-2xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <MdPayments className="text-accent text-6xl opacity-10" />
              </div>
              <div className="space-y-5 sm:space-y-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <MdPerson className="text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-primary text-sm">
                      Maria S.
                    </div>
                    <div className="text-xs text-primary/40">
                      Top Contributor · Level 4
                    </div>
                  </div>
                  <span className="ml-auto text-xs font-bold px-2 py-1 bg-green-50 text-green-600 rounded-full shrink-0">
                    Active
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    {
                      task: "Image labeling batch #48",
                      reward: "$1.20",
                      status: "Approved",
                    },
                    {
                      task: "Sentiment analysis · 20 items",
                      reward: "$2.50",
                      status: "Approved",
                    },
                    {
                      task: "Audio transcription clip",
                      reward: "$0.80",
                      status: "Pending",
                    },
                  ].map((t) => (
                    <div
                      key={t.task}
                      className="flex items-center justify-between text-sm gap-2"
                    >
                      <span className="text-primary/70 truncate min-w-0">
                        {t.task}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-bold text-primary">
                          {t.reward}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.status === "Approved" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"}`}
                        >
                          {t.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center gap-2">
                  <span className="text-sm font-bold text-primary">
                    Earnings this week
                  </span>
                  <span className="text-xl sm:text-2xl font-bold text-secondary shrink-0">
                    $<CountUp value={342.5} decimals={2} />
                  </span>
                </div>
                <Link
                  href="/register?role=worker"
                  className="block w-full py-3.5 sm:py-4 bg-secondary text-white font-bold rounded-lg shadow-lg shadow-secondary/20 text-center hover:scale-95 transition-transform"
                >
                  Withdraw Funds
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-12 md:py-32 overflow-hidden" id="buyers">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
          <div className="flex flex-col lg:flex-row-reverse gap-12 lg:gap-20 items-center">
            <div data-gsap="feature-text" className="lg:w-1/2 w-full min-w-0">
              <div className="inline-block px-4 py-1 bg-primary/5 text-primary text-xs font-bold uppercase tracking-widest rounded mb-6">
                For Business Scale
              </div>
              <h2 className="font-headline text-3xl sm:text-4xl font-bold text-primary mb-6 sm:mb-8">
                Deploy micro-tasks at global scale with zero friction
              </h2>
              <div className="space-y-7 sm:space-y-10">
                {BUYER_FEATURES.map((f) => (
                  <div
                    key={f.title}
                    data-gsap="feature-item"
                    className="flex gap-4 sm:gap-6"
                  >
                    {(() => {
                      const Icon = f.icon;
                      return <Icon className="text-primary mt-1 shrink-0" />;
                    })()}
                    <div className="min-w-0">
                      <h4 className="font-bold text-primary text-lg sm:text-xl mb-1 sm:mb-2">
                        {f.title}
                      </h4>
                      <p className="text-primary/60 font-light text-sm sm:text-base">
                        {f.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div data-gsap="feature-visual" className="lg:w-1/2 w-full min-w-0">
              <div className="bg-primary rounded-2xl p-5 sm:p-10 shadow-2xl overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
                <div className="relative space-y-4 sm:space-y-6">
                  <div className="flex justify-between items-center text-white/50 text-xs font-bold uppercase tracking-widest gap-2">
                    <span>Real-time Operations</span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div className="h-36 sm:h-48 bg-white/5 rounded-xl border border-white/10 p-4 sm:p-6 flex items-end gap-2">
                    {[20, 40, 80, 60, 90, 50].map((h, i) => (
                      <div
                        key={i}
                        className={`w-full rounded-t ${i === 2 || i === 4 ? "bg-secondary" : "bg-secondary/40"}`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/5 p-3 sm:p-4 rounded-lg border border-white/10">
                      <div className="text-[10px] uppercase text-white/40 mb-1">
                        Active Workers
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-white">
                        <CountUp value={8294} />
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 sm:p-4 rounded-lg border border-white/10">
                      <div className="text-[10px] uppercase text-white/40 mb-1">
                        Cost Per Task
                      </div>
                      <div className="text-lg sm:text-xl font-bold text-white">
                        $<CountUp value={0.02} decimals={2} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div data-gsap="feature-text">
            <div className="inline-block px-4 py-1 bg-secondary/10 text-secondary text-xs font-bold uppercase tracking-widest rounded mb-5">
              Coin Economy
            </div>
            <h2 className="font-headline text-4xl font-bold text-primary mb-6">
              Simple, transparent pricing
            </h2>
            <div className="space-y-4 text-primary/70">
              <p className="flex items-start gap-3">
                <MdToll className="text-secondary mt-0.5" />
                <span>
                  <strong className="text-primary">Buyers</strong> purchase 10
                  coins for $1 USD.
                </span>
              </p>
              <p className="flex items-start gap-3">
                <MdPayments className="text-secondary mt-0.5" />
                <span>
                  <strong className="text-primary">Workers</strong> withdraw $1
                  USD per 20 coins earned.
                </span>
              </p>
              <p className="flex items-start gap-3">
                <MdInfo className="text-secondary mt-0.5" />
                <span>
                  The spread between buy and withdraw rates sustains the
                  platform.
                </span>
              </p>
            </div>
          </div>
          <CoinPackageCards />
        </div>
      </section>


      <section className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-20 border-t border-primary/5">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16">
          <div>
            <h2 className="font-headline text-4xl font-bold text-primary mb-3">
              Elite Contributors
            </h2>
            <p className="text-primary/60 font-light">
              Recognizing our highest-performing task masters this month.
            </p>
          </div>
          <Link
            href="/tasks"
            className="text-secondary font-bold flex items-center gap-2 hover:underline shrink-0"
          >
            View leaderboard
            <MdTrendingFlat />
          </Link>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {workerList.map((w) => (
            <div
              key={w.key}
              data-gsap="worker-card"
              className="min-w-[300px] bg-white p-8 rounded-xl shadow-xl shadow-primary/5 snap-start border border-primary/5"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden">
                    {w.photoUrl ? (
                      <img
                        src={w.photoUrl}
                        alt={w.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-secondary text-white font-bold text-xl">
                        {w.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-secondary rounded-full border-2 border-white flex items-center justify-center">
                    <MdVerified className="text-secondary text-xl" />
                  </div>
                </div>
                <h4 className="font-bold text-lg text-primary">{w.name}</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-background p-3 rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary/40 mb-1">
                    Coins Earned
                  </div>
                  <div className="font-bold text-primary flex items-center gap-1">
                    <MdToll className="text-sm text-amber-500" />
                    {w.coins.toLocaleString()}
                  </div>
                </div>
                <div className="bg-background p-3 rounded-lg">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary/40 mb-1">
                    Approved
                  </div>
                  <div className="font-bold text-secondary">
                    {w.approval ?? "Active"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>


      <section className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-32 overflow-hidden border-t border-primary/5">
        <div className="grid md:grid-cols-2 gap-24 items-center">
          <div data-gsap="testimonial-quote" className="relative">
            <div className="absolute -top-12 -left-12 text-[120px] font-black text-primary/5 leading-none select-none">
              &ldquo;
            </div>
            <div className="relative z-10 space-y-8">
              <h2 className="font-headline text-4xl font-bold text-primary">
                Community Voice
              </h2>
              <p className="text-3xl font-light text-primary/80 italic leading-snug">
                &ldquo;TaskHub transformed our data annotation process. We
                scaled from 100 to 10,000 labels a day without sacrificing
                quality. The worker pool is exceptionally professional.&rdquo;
              </p>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center font-bold text-primary text-lg">
                  M
                </div>
                <div>
                  <div className="font-bold text-primary">Marcus Thorne</div>
                  <div className="text-xs font-bold uppercase tracking-widest text-secondary">
                    Head of AI at Datastream
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-8">
            <div
              data-gsap="testimonial-card"
              className="bg-white group hover:bg-primary rounded-2xl shadow-lg p-5 md:p-10 border border-primary/5 transition-all duration-400"
            >
              <div className="flex gap-1 text-amber-400 mb-6">
                {[...Array(5)].map((_, i) => (
                  <MdStar key={i} className="text-amber-400" />
                ))}
              </div>
              <p className="text-lg font-light leading-relaxed text-primary/70 group-hover:text-white mb-6 italic">
                &ldquo;Consistent payouts and a clean interface. Best micro-task
                platform I&apos;ve used. I can earn while traveling without any
                stress.&rdquo;
              </p>
              <div className="text-sm font-bold group-hover:text-white text-primary">
                Elena Petrova ·{" "}
                <span className="group-hover:text-white/40 text-primary/40">
                  Verified Task Master
                </span>
              </div>
            </div>
            <div
              data-gsap="testimonial-card"
              className="bg-white group hover:bg-primary group rounded-2xl shadow-xl p-10 text-primary transition-all duration-400"
            >
              <MdBolt className="text-secondary text-xl" />
              <p className="text-lg font-light leading-relaxed text-primary/70 group-hover:text-white mb-6 italic">
                &ldquo;Lightning fast turnaround on our marketing outreach
                tasks. What used to take a week now takes four hours.&rdquo;
              </p>
              <div className="text-sm font-bold group-hover:text-white text-primary">
                David Chen ·{" "}
                <span className="group-hover:text-white/40 text-primary/40">
                  Startup Founder
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>


      <section className="bg-accent/10 px-4 py-15 md:py-32">
        <div className="max-w-5xl mx-auto px3 md:px-8 text-center space-y-6 md:space-y-12">
          <h2
            data-gsap="impact-heading"
            className="font-headline text-4xl font-bold text-primary"
          >
            Global Impact, Local Empowerment
          </h2>
          <p className="text-xl text-primary/70 font-light leading-relaxed">
            TaskHub isn&apos;t just a platform; it&apos;s a movement providing
            fair-wage opportunities to individuals in 140+ countries. By
            choosing TaskHub, you&apos;re supporting a more equitable digital
            economy.
          </p>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { end: 140, suffix: "+", label: "Countries", icon: "🌍" },
              { end: 12, suffix: "ms", label: "Task Latency", icon: "⚡" },
              { end: 0, suffix: "%", label: "Payment Fees", icon: "💸" },
            ].map((s) => (
              <div
                key={s.label}
                data-gsap="impact-stat"
                className="flex flex-col items-center gap-2 rounded-2xl border border-primary/10 bg-primary/5 px-10 py-8 backdrop-blur-sm w-[280px] "
              >
                <span className="text-2xl">{s.icon}</span>
                <div className="text-4xl font-bold text-primary">
                  <CountUp value={s.end} suffix={s.suffix} />
                </div>
                <div className="text-xs uppercase font-bold tracking-[0.2em] text-primary/40">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      <section
        className="max-w-7xl mx-auto px-4 md:px-8 py-15 md:py-32"
        id="faq"
      >
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          <div className="lg:sticky lg:top-32 space-y-6">
            <span className="inline-block bg-secondary/10 text-secondary px-4 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded">
              Got Questions?
            </span>
            <h2 className="font-headline text-5xl font-extrabold text-primary leading-tight tracking-tighter">
              Everything you need to know.
            </h2>
            <p className="text-primary/60 text-lg leading-relaxed max-w-sm">
              Can&apos;t find the answer you&apos;re looking for? Reach out to
              our support team.
            </p>
            <a
              href="/support"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-lg"
            >
              <MdContactSupport className="text-sm" />
              Visit Support Hub
            </a>

            <div className="hidden lg:block pt-8">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: "bolt", label: "Instant answers" },
                  { icon: "verified_user", label: "Trusted platform" },
                  { icon: "payments", label: "Fast payouts" },
                  { icon: "support_agent", label: "24/7 support" },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-3 bg-white rounded-xl p-4 border hover:bg-primary  border-primary/5 shadow-sm group transition-all duration-200"
                  >
                    <MdCategory className="text-secondary text-xl" />
                    <span className="text-sm font-semibold text-primary group-hover:text-white">
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>


          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <details
                key={item.q}
                data-gsap="faq-item"
                className="group bg-white border border-primary/5 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                {...(item.open ? { open: true } : {})}
              >
                <summary className="flex justify-between items-center cursor-pointer list-none px-4 md:px-7 py-6 gap-4">
                  <div className="flex items-center gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-secondary/10 text-secondary flex items-center justify-center text-xs font-bold font-headline group-open:bg-primary group-open:text-white transition-colors duration-200">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-bold text-primary">{item.q}</span>
                  </div>
                  <MdExpandMore className="text-primary/30 shrink-0 group-open:rotate-180 transition-transform duration-300" />
                </summary>
                <div className="px-7 pb-6 pl-13 md:pl-[4.75rem]">
                  <p className="text-primary/60 text-sm leading-relaxed border-t border-primary/5 pt-4">
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>


      <section className="max-w-7xl mx-auto px-4 md:px-8 pb-15 md:pb-32">
        <div
          data-gsap="cta-box"
          className="bg-primary rounded-3xl px-6 py-8 md:p-16 text-center relative overflow-hidden shadow-2xl"
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-secondary rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto space-y-6">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-headline font-extrabold text-white">
              Ready to redefine how you work?
            </h2>
            <p className="text-white/70 text-base md:text-lg font-light">
              Join the most efficient micro-tasking network today. Signing up
              takes less than 2 minutes.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Link
                href="/register"
                className="bg-secondary text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg hover:scale-105 transition-all shadow-xl shadow-secondary/20"
              >
                Get Started Now
              </Link>
              <Link
                href="/about"
                className="bg-white/10 text-white px-8 py-4 rounded-xl font-bold text-base md:text-lg hover:bg-white/20 transition-all"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
