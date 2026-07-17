export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

export const COIN_PACKAGES = [
  { id: "pkg_10", coins: 10, price: 1, label: "Starter" },
  { id: "pkg_150", coins: 150, price: 10, label: "Basic", popular: false },
  { id: "pkg_500", coins: 500, price: 20, label: "Pro", popular: true },
  { id: "pkg_1000", coins: 1000, price: 35, label: "Elite" },
];

export const WORKER_INITIAL_COINS = 10;
export const BUYER_INITIAL_COINS = 50;
export const COINS_PER_DOLLAR_BUY = 10;
export const COINS_PER_DOLLAR_WITHDRAW = 20;
export const MIN_WITHDRAWAL_COINS = 200;

export const TASK_CATEGORIES = [
  "Social Media",
  "Video & Audio",
  "Writing & Reviews",
  "App Testing",
  "Research",
  "Data Entry",
  "Other",
];

export const COLORS = {
  primary: "#004030",
  primaryDark: "#00281D",
  secondary: "#4A9782",
  accent: "#DCD0A8",
  background: "#FFF9E5",
  surface: "#FFFFFF",
  text: "#00281D",
  textSecondary: "#004030",
  border: "#004030",
  card: "#FFFFFF",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  white: "#FFFFFF",
  amber: "#F59E0B",
};

export const NAV_ITEMS = {
  worker: [
    { label: "Dashboard", icon: "MdDashboard", href: "/(worker)/dashboard" },
    { label: "Browse Tasks", icon: "MdSearch", href: "/(worker)/tasks" },
    { label: "My Submissions", icon: "MdAssignment", href: "/(worker)/submissions" },
    { label: "Earnings", icon: "MdToll", href: "/(worker)/earnings" },
    { label: "Withdrawals", icon: "MdPayments", href: "/(worker)/withdrawals" },
    { label: "Messages", icon: "MdMail", href: "/(worker)/messages" },
    { label: "My Profile", icon: "MdAccountCircle", href: "/(worker)/profile" },
    { label: "Settings", icon: "MdSettings", href: "/(worker)/settings" },
  ] as const,
  buyer: [
    { label: "Dashboard", icon: "MdDashboard", href: "/(buyer)/dashboard" },
    { label: "My Tasks", icon: "MdTask", href: "/(buyer)/tasks" },
    { label: "Review Submissions", icon: "MdRateReview", href: "/(buyer)/submissions" },
    { label: "Messages", icon: "MdMail", href: "/(buyer)/messages" },
    { label: "Buy Coins", icon: "MdToll", href: "/(buyer)/coins" },
    { label: "Payment History", icon: "MdReceiptLong", href: "/(buyer)/payments" },
    { label: "My Profile", icon: "MdAccountCircle", href: "/(buyer)/profile" },
  ] as const,
  admin: [
    { label: "Dashboard", icon: "MdDashboard", href: "/(admin)/dashboard" },
    { label: "Manage Users", icon: "MdGroup", href: "/(admin)/users" },
    { label: "Manage Tasks", icon: "MdTaskAlt", href: "/(admin)/tasks" },
    { label: "Submissions", icon: "MdAssignmentTurnedIn", href: "/(admin)/submissions" },
    { label: "Withdrawals", icon: "MdAccountBalance", href: "/(admin)/withdrawals" },
    { label: "Payments", icon: "MdPayments", href: "/(admin)/payments" },
    { label: "Analytics", icon: "MdAnalytics", href: "/(admin)/stats" },
    { label: "Categories", icon: "MdCategory", href: "/(admin)/categories" },
    { label: "Activity Log", icon: "MdReceiptLong", href: "/(admin)/activity" },
  ] as const,
} as const;
