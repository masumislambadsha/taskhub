export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  tag: string;
  gradient: string;
  gradientAccent: string;
  author: string;
  authorRole: string;
  body: string[];
  tips?: string[];
}

export const posts: BlogPost[] = [
  {
    slug: "micro-task-economy-2026",
    title: "The Rise of the Micro-Task Economy: What Workers Need to Know",
    excerpt:
      "Flexible work isn't the future — it's the new default lane. Here is how micro-task platforms are reshaping income and what workers should look for before they start.",
    date: "2026-07-18",
    readTime: "6 min read",
    tag: "Workers",
    gradient: "from-primary to-secondary",
    gradientAccent: "from-secondary to-accent",
    author: "Ananya Rahman",
    authorRole: "Growth Lead, TaskHub",
    body: [
      "Small, well-defined jobs have existed for as long as markets have. What changed in the last decade is tooling and reach. A platform like TaskHub connects thousands of distributed workers with buyers who need precise, quick execution — data labeling, transcriptions, product reviews, and countless research-grade tasks.",
      "For workers, the appeal is obvious: no commute, no fixed schedule, and the ability to stack income streams. The best earners treat it like a craft — they keep a routine, protect a block of attention each day, and choose tasks that match their demonstrated skills rather than chasing the highest sticker payout.",
      "What separates a trustworthy platform from a gimmick comes down to a few hard facts. First: is the payout transparent? You should always see the exact reward before you apply. Second: what happens on a rejection? Good platforms protect your existing balance and give you clear feedback. Third: how fast can you actually turn earnings into cash?",
      "On TaskHub, rewards are written before you apply, rejected submissions never deduct from your balance, and withdrawals unlock the moment you cross the minimum threshold. That kind of clarity is what lets a serious earner plan months ahead instead of guessing week to week.",
    ],
    tips: [
      "Start with a focused niche you can finish fast",
      "Read instructions twice before submitting",
      "Build a consistent daily schedule",
    ],
  },
  {
    slug: "how-to-maximize-taskhub-earnings",
    title: "How to Maximize TaskHub Earnings: A Worker's Playbook",
    excerpt:
      "Working more isn't the same as working smarter. Here's a practical playbook to raise your approval rate and grow your TaskHub earnings steadily.",
    date: "2026-07-02",
    readTime: "8 min read",
    tag: "Guides",
    gradient: "from-secondary to-secondary",
    gradientAccent: "from-accent to-secondary",
    author: "Jonas Weber",
    authorRole: "Top Task Master",
    body: [
      "For a micro-task worker, the single most valuable metric is the approval rate. Buyers watch it — and the platform's ranking does too. Improve your approvals and both your volume and the quality of tasks sent your way will improve as well.",
      "The highest-leverage habit is reading the submission instructions until they're second nature. Most rejections come from proof that doesn't match what the buyer explicitly asked for. Screenshot where a screenshot is requested, quote where quoting is requested, and keep your proof concise but complete.",
      "Second, resist taking everything it resembles your pace. A task you finish in twenty minutes at a fair reward beats three tasks you fumble in the same hour. Understand where you are actually fast and defend it.",
      "Third, treat consistency as strategy. A small, reliable block of time each day compounds your balance far more than a chaotic binge on the weekend. With a 200-coin minimum and a clear withdrawal rate, a steady pace converts directly into usable cash.",
    ],
    tips: [
      "Tie every proof piece directly to the task",
      "Review your approval rate weekly",
      "Keep withdrawing cleanly at each milestone",
    ],
  },
  {
    slug: "buyers-guide-posting-tasks",
    title: "A Buyer's Guide to Posting Tasks People Actually Complete",
    excerpt:
      "The way you write a task determines who finishes it and how much you have to re-review. These field-tested patterns cut review time and raise quality.",
    date: "2026-06-21",
    readTime: "7 min read",
    tag: "Buyers",
    gradient: "from-accent to-secondary",
    gradientAccent: "from-primary to-accent",
    author: "Priya Sharma",
    authorRole: "Operations Director",
    body: [
      "Every hour you save while iterating a precise task spec is an hour you don't spend re-reviewing bad submissions. Strong buyers describe the output, not just the intention of the work.",
      "Start with the outcome, not the instruction. 'Write a short review' is far weaker than 'Write a 3-line review praising battery life and value, and attach a screenshot of the posted review.' The second sentence removes ambiguity and lets workers self-select honestly.",
      "Next, price for completion, not appearances. A task that genuinely consumes attention deserves real compensation. Workers compare offers — a fair rate plus a clean brief means applicants that accept come back and finish, saving you from drawing a crowd of abandoned starts.",
      "Finally, decide fast. Workers remember quick-but-fair buyers. A decisive approval culture builds the neighborhood of repeat business, honest feedback, and a profile that high quality speed workers look for.",
    ],
    tips: [
      "Define the visible output plus proof of it",
      "Price for the time your task really takes",
      "Approve decisively to build repeat relationships",
    ],
  },
  {
    slug: "coin-economy-explained",
    title: "The Coin Economy, Explained in Plain Language",
    excerpt:
      "Coins, buy rates, withdrawal rates, platform fees — before you spend a single coin, understand what the wallet actually represents.",
    date: "2026-06-05",
    readTime: "5 min read",
    tag: "Finance",
    gradient: "from-secondary to-primary",
    gradientAccent: "from-secondary to-accent",
    author: "Maya Thorne",
    authorRole: "Platform Economist",
    body: [
      "An in-platform currency only works when both sides can see exactly what it buys and how it leaves. On TaskHub, coins are the ledger of work: buyers fund tasks, workers turn completed work into coins, and everyone reads the same exchange rates.",
      "Buyers purchase 10 coins for $1 and spend them funding tasks. Workers earn coins on approvals and withdraw them at 20 coins per $1. The spread between those two rates is TaskHub's transparent fee — nothing is hidden on either side.",
      "That asymmetry is the business, and it stays honest because it is aligned with both roles. Buyers want high-quality, well-scoped work. Workers want tasks they can complete and get paid for reliably. The platform earns the difference, so its interests point the same direction as theirs.",
      "Understanding this changes your decision — as a buyer, fund tasks realistically and review fairly; as a worker, track your effective hourly yield, not just your submitted volume.",
    ],
  },
  {
    slug: "proof-submissions-that-get-approved",
    title: "Write Proof Submissions That Clear Review the First Time",
    excerpt:
      "Most rejected submissions aren't bad work — they're proofs that don't broadcast the work. Here's the mental model reviewers use, and how to pass it every time.",
    date: "2026-05-14",
    readTime: "6 min read",
    tag: "Guides",
    gradient: "from-primary to-accent",
    gradientAccent: "from-secondary to-accent",
    author: "Ali Nazir",
    authorRole: "Senior Reviewer",
    body: [
      "Reviewers ask one question: does the proof demonstrate the task was done as requested? If your submission describes your answer instead of showing it, the reviewer has no evidence and it fails.",
      "Think in triples. Every submission should carry three things: (1) the concrete result, (2) proof of it — a link, a screenshot, or image — and (3) one short line tying them together. 'Posted the 5-star review — attached screenshot shows it live' clears the whole job in seconds.",
      "Trim the noise. Reviewers sorting through long walls of text will miss the very evidence you want them to see. Put the decisive proof first, then any context that genuinely supports it.",
      "And run the re-read: compare your submission against the buyer's instructions one last time before sending. That two-minute habit removes most of the reasons a great task gets rejected.",
    ],
  },
  {
    slug: "badges-reputation-and-leaderboard",
    title: "Badges, Reputation & the Leaderboard: How It Really Works",
    excerpt:
      "The leaderboard is built from the boring stuff — consistent approvals, verified identity, and a reputation that compounds over time.",
    date: "2026-04-20",
    readTime: "6 min read",
    tag: "Community",
    gradient: "from-accent to-primary",
    gradientAccent: "from-primary to-secondary",
    author: "Jonas Weber",
    authorRole: "Top Task Master",
    body: [
      "Anonymous marketplaces collapse without trust. That's why we build a reputation layer: badges for milestones, profiles for context, and a public leaderboard every worker can see.",
      "The leaderboard ranks strictly by approved coins. There's no gaming it — only approved submissions count. That's the social contract: the visible reward is granted for real, verifiable work.",
      "Badges echo long-run behaviour, not one-off luck. Verified identity, your first one hundred approved tasks, hundred-day attendance — milestones that describe a worker who keeps showing up. They live on your profile and make buyers prefer you.",
      "If you want the leaderboard, do the boring things with precision. Take the task seriously, verify your identity, submit work you are confident a buyer will approve, and let a compounding reputation finish the job.",
    ],
  },
];

export function getPostBySlug(slug: string) {
  return posts.find((p) => p.slug === slug);
}