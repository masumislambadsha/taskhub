import Link from "next/link";

const SECTIONS = [
  {
    icon: "database",
    number: "01",
    title: "Information We Collect",
    badge: "Data Collection",
    badgeColor: "bg-blue-50 text-blue-700",
    content:
      "We collect information you provide directly when you register, such as your name, email address, and payment details. We also automatically collect usage data including pages visited, tasks posted or completed, submission history, and transaction records. Device information such as IP address, browser type, and operating system may also be logged for security and analytics purposes.",
    bullets: [
      "Account registration data (name, email, password hash)",
      "Payment and withdrawal information",
      "Task activity and submission history",
      "Device and browser metadata",
      "Communications sent through our support system",
    ],
  },
  {
    icon: "settings_suggest",
    number: "02",
    title: "How We Use Your Information",
    badge: "Usage",
    badgeColor: "bg-green-50 text-green-700",
    content:
      "Your data powers the TaskHub experience. We use it to operate and improve the platform, process coin purchases and withdrawals, send transactional notifications, and detect fraudulent or abusive behavior. We do not sell, rent, or trade your personal data to third parties for marketing purposes.",
    bullets: [
      "Authenticate your identity and manage your session",
      "Process payments and coin transactions",
      "Send task, submission, and payment notifications",
      "Detect fraud, abuse, and policy violations",
      "Improve platform features through aggregated analytics",
    ],
  },
  {
    icon: "share",
    number: "03",
    title: "Data Sharing",
    badge: "Third Parties",
    badgeColor: "bg-amber-50 text-amber-700",
    content:
      "We share limited data only when necessary to operate the platform. Worker display names and submission content are visible to the buyers who posted the relevant tasks. We share payment data with our payment processors solely to facilitate transactions. We may disclose data to law enforcement if required by a valid legal order.",
    bullets: [
      "Worker names visible to buyers for their submitted tasks",
      "Payment data shared with Stripe / bKash for processing",
      "Aggregated, anonymized analytics may be shared publicly",
      "Legal disclosures when required by law",
    ],
  },
  {
    icon: "lock",
    number: "04",
    title: "Data Security",
    badge: "Security",
    badgeColor: "bg-purple-50 text-purple-700",
    content:
      "We take security seriously. All data is transmitted over HTTPS/TLS. Passwords are hashed using industry-standard algorithms and never stored in plain text. We conduct regular security reviews and limit internal access to personal data on a need-to-know basis. Despite these measures, no system is 100% secure — we encourage you to use a strong, unique password.",
    bullets: [
      "All traffic encrypted via HTTPS/TLS",
      "Passwords hashed — never stored in plain text",
      "Role-based internal access controls",
      "Regular security audits and vulnerability reviews",
    ],
  },
  {
    icon: "cookie",
    number: "05",
    title: "Cookies & Tracking",
    badge: "Cookies",
    badgeColor: "bg-orange-50 text-orange-700",
    content:
      "We use essential cookies to maintain your login session and remember your preferences. We may use analytics cookies to understand how users navigate the platform so we can improve it. We do not use third-party advertising cookies. You can control or disable cookies through your browser settings, though doing so may affect platform functionality.",
    bullets: [
      "Session cookies to keep you logged in",
      "Preference cookies for UI settings",
      "Analytics cookies (first-party, anonymized)",
      "No third-party advertising or tracking cookies",
    ],
  },
  {
    icon: "person_check",
    number: "06",
    title: "Your Rights",
    badge: "Your Control",
    badgeColor: "bg-teal-50 text-teal-700",
    content:
      "You have meaningful control over your personal data. You can access, correct, or update your account information at any time from your profile settings. You may request a full export of your data or ask us to delete your account and associated personal data. Certain data such as transaction records may be retained for legal compliance even after deletion.",
    bullets: [
      "Access and review your personal data",
      "Correct inaccurate information via profile settings",
      "Request a data export (JSON format)",
      "Request account and data deletion",
      "Object to certain types of data processing",
    ],
  },
  {
    icon: "history",
    number: "07",
    title: "Data Retention",
    badge: "Retention",
    badgeColor: "bg-slate-100 text-slate-700",
    content:
      "We retain your personal data for as long as your account is active or as needed to provide our services. If you delete your account, we will remove your personal profile data within 30 days. Transaction records, submission history, and financial data are retained for up to 7 years to comply with legal and tax obligations.",
    bullets: [
      "Active account data: retained while account is open",
      "Profile data deleted within 30 days of account closure",
      "Transaction records retained for 7 years (legal compliance)",
      "Support communications retained for 2 years",
    ],
  },
  {
    icon: "child_care",
    number: "08",
    title: "Children's Privacy",
    badge: "Age Policy",
    badgeColor: "bg-red-50 text-red-700",
    content:
      "TaskHub is strictly intended for users who are 18 years of age or older. We do not knowingly collect, store, or process personal information from anyone under 18. If we become aware that a minor has created an account, we will immediately suspend it and delete all associated data.",
    bullets: [],
  },
  {
    icon: "update",
    number: "09",
    title: "Policy Updates",
    badge: "Changes",
    badgeColor: "bg-indigo-50 text-indigo-700",
    content:
      "We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. When we make material changes, we will notify you via email or an in-app notification at least 7 days before the changes take effect. The date at the top of this page always reflects the most recent revision.",
    bullets: [],
  },
  {
    icon: "support_agent",
    number: "10",
    title: "Contact & Data Requests",
    badge: "Contact",
    badgeColor: "bg-secondary/10 text-secondary",
    content:
      "To exercise any of your data rights, ask questions about this policy, or report a privacy concern, please contact us through our Support Hub. We aim to respond to all privacy-related requests within 5 business days. For formal data deletion or export requests, please include your registered email address.",
    bullets: [],
  },
];

const PRINCIPLES = [
  {
    icon: "visibility_off",
    title: "No data selling",
    desc: "We never sell your personal data to advertisers or data brokers.",
  },
  {
    icon: "lock",
    title: "Encrypted in transit",
    desc: "All data moves over HTTPS. Passwords are hashed, never stored plain.",
  },
  {
    icon: "manage_accounts",
    title: "You're in control",
    desc: "Access, correct, export, or delete your data at any time.",
  },
  {
    icon: "child_care",
    title: "18+ only",
    desc: "We do not knowingly collect data from anyone under 18.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="pb-24">
      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-16 sm:py-20 px-4 sm:px-8">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Legal
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none mb-4">
            Privacy
            <br />
            <span className="text-secondary">Policy</span>
          </h1>
          <p className="text-white/50 text-sm mt-4 max-w-xl leading-relaxed">
            Your privacy matters to us. This policy explains exactly what data
            we collect, why we collect it, and how you can control it.
          </p>
          <p className="text-white/30 text-xs mt-4">
            Last updated: January 1, 2024
          </p>
        </div>
      </section>

      {/* Core principles */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-6 sm:-mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl border border-primary/5 shadow-md p-5 text-center"
            >
              <span className="material-symbols-outlined text-secondary text-2xl mb-2 block">
                {p.icon}
              </span>
              <p className="font-headline text-sm font-extrabold text-primary">
                {p.title}
              </p>
              <p className="text-[11px] text-primary/40 mt-1 leading-snug">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Intro callout */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-10 sm:mt-12">
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-5 sm:p-7 flex gap-4 sm:gap-5 items-start">
          <span className="material-symbols-outlined text-secondary text-3xl shrink-0 mt-0.5">
            privacy_tip
          </span>
          <div>
            <p className="font-bold text-primary mb-1">The short version</p>
            <p className="text-sm text-primary/60 leading-relaxed">
              We collect only what we need to run the platform. We never sell
              your data. You can access, correct, or delete your information at
              any time. We use industry-standard security and comply with
              applicable data protection laws.
            </p>
          </div>
        </div>
      </section>

      {/* Sections */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-10 sm:mt-14 space-y-4 sm:space-y-5">
        {SECTIONS.map((s) => (
          <div
            key={s.number}
            className="group bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all p-4 sm:p-7"
          >
            <div className="flex gap-4 sm:gap-5 items-start">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center group-hover:bg-secondary transition-colors">
                <span className="material-symbols-outlined text-secondary group-hover:text-white text-xl transition-colors">
                  {s.icon}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="text-[10px] font-extrabold text-primary/20 font-headline">
                    {s.number}
                  </span>
                  <h2 className="font-headline font-bold text-primary text-base">
                    {s.title}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.badgeColor}`}
                  >
                    {s.badge}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-primary/60 leading-relaxed mb-3">
                  {s.content}
                </p>
                {s.bullets.length > 0 && (
                  <ul className="space-y-1.5">
                    {s.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 text-sm text-primary/50"
                      >
                        <span className="material-symbols-outlined text-secondary text-sm mt-0.5 shrink-0">
                          check_circle
                        </span>
                        {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-12 sm:mt-16">
        <div className="bg-primary rounded-3xl p-7 sm:p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="font-headline text-2xl font-extrabold text-white mb-2">
              Want to manage your data?
            </h3>
            <p className="text-white/50 text-xs sm:text-sm max-w-md leading-relaxed">
              You can request a data export, correct your information, or delete
              your account at any time. Our support team is here to help.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/support"
              className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-lg font-bold text-xs sm:text-sm hover:bg-secondary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                support_agent
              </span>
              Contact Support
            </Link>
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">gavel</span>
              Terms of Service
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
