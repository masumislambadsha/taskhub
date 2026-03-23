import Link from "next/link";

const BUYER_STEPS = [
  {
    icon: "toll",
    step: "01",
    title: "Buy Coins",
    desc: "Purchase coins starting at $1 for 10 coins. Choose a package that fits your budget — bulk packages offer better value.",
  },
  {
    icon: "post_add",
    step: "02",
    title: "Post a Task",
    desc: "Write clear instructions, set the coin payout per worker, choose how many workers you need, and set a deadline.",
  },
  {
    icon: "group",
    step: "03",
    title: "Workers Submit",
    desc: "Workers from around the world find your task, complete it, and submit proof. You get notified for each submission.",
  },
  {
    icon: "verified",
    step: "04",
    title: "Approve & Pay",
    desc: "Review each submission. Approve the ones that meet your standard — coins transfer only on approval. Reject bad work for free.",
  },
];

const WORKER_STEPS = [
  {
    icon: "person_add",
    step: "01",
    title: "Create an Account",
    desc: "Sign up free as a Worker. You get 10 starter coins just for joining. No portfolio or experience required.",
  },
  {
    icon: "search",
    step: "02",
    title: "Browse Tasks",
    desc: "Filter tasks by category, payout, or deadline. Read the instructions carefully before you start.",
  },
  {
    icon: "upload_file",
    step: "03",
    title: "Submit Your Work",
    desc: "Complete the task and submit your proof — a screenshot, link, or written response depending on the task type.",
  },
  {
    icon: "savings",
    step: "04",
    title: "Earn & Withdraw",
    desc: "Coins land in your account the moment a buyer approves. Hit 200 coins and request a cash withdrawal anytime.",
  },
];

const COIN_FACTS = [
  {
    icon: "shopping_cart",
    label: "10 coins = $1",
    sub: "Buyer purchase rate",
    color: "bg-blue-50 text-blue-700",
  },
  {
    icon: "savings",
    label: "20 coins = $1",
    sub: "Worker withdrawal rate",
    color: "bg-green-50 text-green-700",
  },
  {
    icon: "account_balance_wallet",
    label: "200 coins min",
    sub: "Minimum withdrawal",
    color: "bg-amber-50 text-amber-700",
  },
  {
    icon: "timer",
    label: "24h payout",
    sub: "Average processing time",
    color: "bg-purple-50 text-purple-700",
  },
];

const PAYMENT_METHODS = [
  { icon: "credit_card", name: "Stripe", note: "Global — cards & wallets" },
  { icon: "phone_android", name: "bKash", note: "Bangladesh mobile banking" },
  { icon: "account_balance", name: "SSLCommerz", note: "Bangladesh gateway" },
];

export default function HowItWorksPage() {
  return (
    <main className="pb-24 overflow-hidden">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-15 md:py-24 px-4 md:px-8">
        <div className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            How It Works
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-7xl font-extrabold text-white tracking-tighter leading-none mb-6">
            Simple by design.
            <br />
            <span className="text-secondary">Powerful in practice.</span>
          </h1>
          <p className="text-white/60 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            TaskHub runs on a coin economy that keeps things transparent for
            everyone. Buyers fund tasks, workers complete them, and coins only
            move when work is approved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Link
              href="/register"
              className="bg-secondary text-white px-7 py-3 rounded-lg font-bold text-sm hover:bg-secondary/90 transition-colors"
            >
              Get Started Free
            </Link>
            <Link
              href="/tasks"
              className="bg-white/10 text-white px-7 py-3 rounded-lg font-bold text-sm hover:bg-white/20 transition-colors"
            >
              Browse Tasks
            </Link>
          </div>
        </div>
      </section>

      {/* Coin facts */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {COIN_FACTS.map((f) => (
            <div
              key={f.label}
              className="bg-white rounded-2xl border border-primary/5 shadow-md p-4 sm:p-5 text-center"
            >
              <span className="material-symbols-outlined text-secondary text-2xl mb-2 block">
                {f.icon}
              </span>
              <p className="font-headline text-sm sm:text-base font-extrabold text-primary">
                {f.label}
              </p>
              <p className="text-[11px] text-primary/40 mt-1">{f.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* For Buyers */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 mt-10 sm:mt-20">
        <div className="flex items-center gap-4 mb-8 sm:mb-10">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary text-lg sm:text-xl">
              business_center
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              For Buyers
            </span>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary tracking-tighter">
              Get tasks done in 4 steps
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {BUYER_STEPS.map((s) => (
            <div
              key={s.step}
              className="group bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all p-5 sm:p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary group-hover:bg-secondary transition-colors flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary group-hover:text-white text-lg transition-colors">
                    {s.icon}
                  </span>
                </div>
                <span className="font-headline text-2xl font-extrabold text-primary/10">
                  {s.step}
                </span>
              </div>
              <h3 className="font-bold text-primary mb-2">{s.title}</h3>
              <p className="text-sm text-primary/55 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-8 mt-12 mb-12 sm:mt-16 sm:mb-16">
        <div className="h-px bg-primary/5" />
      </div>

      {/* For Workers */}
      <section className="max-w-5xl mx-auto px-4 md:px-8">
        <div className="flex items-center gap-4 mb-8 sm:mb-10">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-lg sm:text-xl">
              engineering
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              For Workers
            </span>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary tracking-tighter">
              Start earning in 4 steps
            </h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {WORKER_STEPS.map((s) => (
            <div
              key={s.step}
              className="group bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all p-5 sm:p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-secondary/10 group-hover:bg-secondary transition-colors flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-secondary group-hover:text-white text-lg transition-colors">
                    {s.icon}
                  </span>
                </div>
                <span className="font-headline text-2xl font-extrabold text-primary/10">
                  {s.step}
                </span>
              </div>
              <h3 className="font-bold text-primary mb-2">{s.title}</h3>
              <p className="text-sm text-primary/55 leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Coin economy explainer */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 py-15 md:py-32">
        <div className="bg-primary rounded-3xl p-6 sm:p-10 md:p-14">
          <div className="text-center mb-8 sm:mb-10">
            <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
              The Coin Economy
            </span>
            <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-white tracking-tighter">
              Transparent pricing, no surprises
            </h2>
            <p className="text-white/50 text-sm mt-2 max-w-lg mx-auto">
              The spread between buy and sell rates is how TaskHub earns — no
              hidden fees, no commissions taken from your earnings.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-10">
            <div className="bg-white/5 rounded-2xl p-5 sm:p-6 text-center">
              <span className="material-symbols-outlined text-secondary text-3xl mb-3 block">
                shopping_cart
              </span>
              <p className="font-headline text-xl sm:text-2xl font-extrabold text-white">
                $1 = 10 coins
              </p>
              <p className="text-white/40 text-xs mt-1">Buyer purchase rate</p>
            </div>
            <div className="bg-secondary/20 rounded-2xl p-5 sm:p-6 text-center flex flex-col items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-3xl mb-3 block">
                swap_horiz
              </span>
              <p className="font-headline text-lg font-extrabold text-white">
                Platform fee
              </p>
              <p className="text-white/40 text-xs mt-1">
                Built into the spread
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 sm:p-6 text-center">
              <span className="material-symbols-outlined text-secondary text-3xl mb-3 block">
                savings
              </span>
              <p className="font-headline text-xl sm:text-2xl font-extrabold text-white">
                20 coins = $1
              </p>
              <p className="text-white/40 text-xs mt-1">
                Worker withdrawal rate
              </p>
            </div>
          </div>
          <div className="bg-white/5 rounded-2xl p-5 sm:p-6">
            <p className="text-white/60 text-sm text-center leading-relaxed">
              Example: A buyer funds a task with 100 coins ($10). A worker
              completes it and earns 100 coins — worth $5 on withdrawal. TaskHub
              keeps the $5 difference as its fee.
            </p>
          </div>
        </div>
      </section>

      {/* Payment methods */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pb-15 md:pb-32">
        <div className="text-center mb-8">
          <span className="inline-block bg-secondary/10 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-4">
            Payment Methods
          </span>
          <h2 className="font-headline text-2xl sm:text-3xl font-extrabold text-primary tracking-tighter">
            Pay and get paid your way
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {PAYMENT_METHODS.map((m) => (
            <div
              key={m.name}
              className="bg-white rounded-2xl border border-primary/5 shadow-sm p-6 sm:p-7 text-center hover:shadow-md hover:border-secondary/20 transition-all"
            >
              <span className="material-symbols-outlined text-secondary text-3xl mb-3 block">
                {m.icon}
              </span>
              <p className="font-bold text-primary">{m.name}</p>
              <p className="text-xs text-primary/40 mt-1">{m.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 md:px-8 pb-15 md:pb-32">
        <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
          <div className="bg-secondary/10 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
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
          <div className="bg-primary rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
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
