import Link from "next/link";
import iconMap from '@/lib/iconMap';
import { MdCategory, MdInfo, MdPrivacyTip, MdSupportAgent } from 'react-icons/md';

const SECTIONS = [
  {
    icon: "handshake",
    number: "01",
    title: "Acceptance of Terms",
    content:
      "By accessing or using TaskHub, you confirm that you are at least 18 years old and agree to be legally bound by these Terms of Service. If you are using TaskHub on behalf of an organization, you represent that you have the authority to bind that organization to these terms. If you do not agree, please discontinue use immediately.",
  },
  {
    icon: "storefront",
    number: "02",
    title: "Platform Description",
    content:
      "TaskHub is a micro-task marketplace that bridges the gap between buyers who need small digital jobs done and workers who want to earn real money on their own schedule. Buyers post tasks funded by coins; workers complete those tasks and earn coins redeemable for cash. TaskHub acts solely as an intermediary and is not a party to any agreement between buyers and workers.",
  },
  {
    icon: "toll",
    number: "03",
    title: "Coin Economy",
    content:
      "Buyers purchase coins at a rate of 10 coins per $1 USD. Workers withdraw coins at a rate of 20 coins per $1 USD, with a minimum withdrawal of 200 coins. The spread between purchase and withdrawal rates constitutes TaskHub's platform fee. All coin purchases are non-refundable. Coins have no cash value outside the platform and cannot be transferred between accounts.",
  },
  {
    icon: "manage_accounts",
    number: "04",
    title: "User Responsibilities",
    content:
      "You are solely responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Workers must submit original, honest, and high-quality work that fully satisfies the task requirements. Buyers must provide clear, lawful task instructions and review submissions in good faith within the allotted timeframe.",
  },
  {
    icon: "gpp_bad",
    number: "05",
    title: "Prohibited Activities",
    content:
      "The following are strictly forbidden: submitting fake, plagiarized, or AI-generated work where not permitted; creating multiple accounts to game the system; harassing or threatening other users; posting tasks that involve illegal content, hate speech, or privacy violations; attempting to circumvent the platform's payment system; and any form of fraud or misrepresentation. Violations may result in immediate account suspension and forfeiture of coins.",
  },
  {
    icon: "payments",
    number: "06",
    title: "Payments & Disputes",
    content:
      "Coins are held in escrow when a task is accepted by a worker. They are released to the worker only upon buyer approval. If a buyer does not respond within 3 days of submission, the coins are automatically released. Disputes must be raised within 24 hours of a rejection. TaskHub's admin team will review disputed submissions and issue a final, binding decision.",
  },
  {
    icon: "block",
    number: "07",
    title: "Termination",
    content:
      "TaskHub reserves the right to suspend or permanently terminate any account that violates these terms, engages in fraudulent activity, or poses a risk to the platform or its users — without prior notice. Upon termination, any remaining coins may be forfeited. Users may request account deletion at any time by contacting support; pending withdrawals will be processed before closure.",
  },
  {
    icon: "shield",
    number: "08",
    title: "Limitation of Liability",
    content:
      "TaskHub provides the platform on an 'as-is' basis. We are not liable for any indirect, incidental, special, or consequential damages, including loss of earnings, data, or business opportunities. Our total aggregate liability to any user shall not exceed the total amount of coins purchased or earned by that user in the 12 months preceding the claim.",
  },
  {
    icon: "edit_document",
    number: "09",
    title: "Changes to Terms",
    content:
      "We may revise these Terms at any time. When we do, we will update the 'Last updated' date at the top of this page and, for material changes, notify users via email or an in-app banner. Your continued use of TaskHub after changes are posted constitutes your acceptance of the revised Terms.",
  },
  {
    icon: "support_agent",
    number: "10",
    title: "Contact & Governing Law",
    content:
      "These Terms are governed by applicable law. For any questions, disputes, or legal notices, please reach out through our Support Hub. We aim to respond to all legal inquiries within 5 business days.",
  },
];

const HIGHLIGHTS = [
  { icon: "toll", label: "10 coins / $1", sub: "Buyer purchase rate" },
  { icon: "savings", label: "20 coins / $1", sub: "Worker withdrawal rate" },
  { icon: "timer", label: "3-day auto-release", sub: "Unanswered submissions" },
  { icon: "verified_user", label: "18+ only", sub: "Age requirement" },
];

export default function TermsPage() {
  return (
    <main className="pb-24">
      
      <section className="relative overflow-hidden bg-primary py-16 sm:py-20 px-4 sm:px-8">
        <div className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full bg-secondary/10" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-white/5" />
        <div className="relative max-w-4xl mx-auto">
          <span className="inline-block bg-secondary/20 text-secondary px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded mb-5">
            Legal
          </span>
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tighter leading-none mb-4">
            Terms of
            <br />
            <span className="text-secondary">Service</span>
          </h1>
          <p className="text-white/50 text-sm mt-4 max-w-xl leading-relaxed">
            These terms govern your use of TaskHub. Please read them carefully —
            they explain your rights, responsibilities, and how our coin economy
            works.
          </p>
          <p className="text-white/30 text-xs mt-4">
            Last updated: January 1, 2024
          </p>
        </div>
      </section>

      
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-6 sm:-mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.label}
              className="bg-white rounded-2xl border border-primary/5 shadow-md p-5 text-center"
            >
              <MdCategory className="text-secondary text-xl" />
              <p className="font-headline text-base font-extrabold text-primary">
                {h.label}
              </p>
              <p className="text-[11px] text-primary/40 mt-1 font-medium">
                {h.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-12">
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 py-5 sm:p-7 flex gap-5 items-start">
          <MdInfo className="text-secondary text-3xl shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-primary mb-1">
              Plain-language summary
            </p>
            <p className="text-sm text-primary/60 leading-relaxed">
              TaskHub connects buyers and workers through a coin-based economy.
              Buyers fund tasks; workers complete them and earn coins they can
              cash out. We charge a spread between buy and sell rates as our
              fee. Play fair, submit real work, and everyone wins.
            </p>
          </div>
        </div>
      </section>

      
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-10 sm:mt-14">
        <div className="space-y-4 sm:space-y-5">
          {SECTIONS.map((s) => (
            <div
              key={s.number}
              className="group bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md hover:border-secondary/20 transition-all p-5 sm:p-7"
            >
              <div className="flex gap-4 sm:gap-5 items-start">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary flex items-center justify-center group-hover:bg-secondary transition-colors">
                  {(() => { const Icon = iconMap[s.icon] ?? MdCategory; return <Icon className="text-xl group-hover:text-white text-secondary" />; })()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-extrabold text-primary/20 font-headline">
                      {s.number}
                    </span>
                    <h2 className="font-headline font-bold text-primary text-base">
                      {s.title}
                    </h2>
                  </div>
                  <p className="text-xs sm:text-sm text-primary/60 leading-relaxed">
                    {s.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      
      <section className="max-w-5xl mx-auto px-4 sm:px-8 mt-12 sm:mt-16">
        <div className="bg-primary rounded-3xl p-7 sm:p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <h3 className="font-headline text-2xl font-extrabold text-white mb-2">
              Questions about these terms?
            </h3>
            <p className="text-white/50 text-sm max-w-md leading-relaxed">
              Our support team is happy to clarify anything. You can also review
              our Privacy Policy to understand how we handle your data.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/support"
              className="inline-flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-lg font-bold text-xs sm:text-sm hover:bg-secondary/90 transition-colors"
            >
              <MdSupportAgent className="text-sm" />
              Contact Support
            </Link>
            <Link
              href="/privacy"
              className="inline-flex items-center gap-2 bg-white/10 text-white px-6 py-3 rounded-lg font-bold text-xs sm:text-sm hover:bg-white/20 transition-colors"
            >
              <MdPrivacyTip className="text-sm" />
              Privacy Policy
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}



