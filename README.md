# ⚡ TaskHub — Micro-Task & Earning Platform

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38B2AC)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248)
![Stripe](https://img.shields.io/badge/Stripe-Payment-635BFF)
![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101)
![NextAuth](https://img.shields.io/badge/NextAuth-v5-purple)

> A production-style SaaS platform connecting Buyers who need small online tasks done with Workers who earn coins by completing them. Features a full coin economy, Stripe payments, real-time Socket.io messaging & notifications, and role-based dashboards — built to demonstrate real-world full-stack architecture.

---

## 🎯 Project Overview

TaskHub is a comprehensive micro-task marketplace where Buyers post tasks (watch a video, write a review, test an app, do research) and Workers earn coins by completing them. Workers and Buyers can communicate directly through a built-in real-time chat system powered by Socket.io — conversations are scoped to tasks, with typing indicators, read receipts, and persistent message history.

The platform runs on a transparent coin economy — Buyers purchase coins to fund tasks, Workers earn coins on approval and cash out via withdrawal requests.

Unlike a basic CRUD app, TaskHub is designed as a production-style SaaS:

- **3 distinct user roles** with real-world responsibilities and separate dashboards
- **Real-time messaging** — Socket.io direct chat between Workers and Buyers, scoped to tasks, with typing indicators and read receipts
- **Live notifications** — bell icon with unread badge, action routing, and server-side triggers on key events
- **Coin economy with monetization logic** — buy rate vs withdrawal rate spread is the platform's revenue
- **Secure auth** with Google OAuth and email/password via NextAuth v5
- **Real payment integration** via Stripe Checkout with webhook verification
- **Admin panel** with advanced analytics, charts, and full platform management
- **Public leaderboard** showing top earners ranked by approved coins
- **Fully responsive** — mobile, tablet, and desktop layouts throughout

---

## ✨ Key Features

### For Workers:

- 🔍 Browse and filter tasks by keyword, payout amount, category, and deadline
- 📝 Submit proof with text details, multiple proof links, and optional image upload via imgBB
- 📊 Track all submissions by status — pending, approved, rejected — with paginated history
- 💰 View available coin balance, pending clearance coins, and lifetime earnings in USD
- 🏧 Request withdrawals once balance hits 200 coins minimum (≈ $10 USD)
- 📈 Personal earnings portal with full transaction history (earnings + withdrawals combined)
- 💬 Direct real-time messaging with Buyers, linked to specific tasks
- 🔔 Live notification bell with unread count — get notified on approvals, rejections, and withdrawal status
- 🏆 Appear on the public leaderboard ranked by total approved coins
- 👤 Profile page with stats, badges, and submission history
- ⚙️ Settings page for account preferences

### For Buyers:

- 📋 Create tasks with title, description, category, required worker count, coin payout per worker, deadline, submission instructions, and task image
- 💡 Automatic coin deduction on task creation — total cost = requiredWorkers × payableAmount
- 👀 Review worker submissions one by one — view full proof details, links, and images
- ✅ Approve submissions to credit worker coins instantly
- ❌ Reject submissions to free up the worker slot for re-submission
- 📊 Dashboard with task activity chart (7-day bar chart), approval rate, and submission breakdown
- 🪙 Purchase coins via Stripe, bKash, or SSLCommerz with 4 package tiers
- 📜 Full payment history with gateway, coins, amount, and transaction ID
- 💬 Direct real-time messaging with Workers, linked to task context
- 🔔 Notifications for new submissions and platform events
- ✏️ Edit task title, description, and instructions after creation
- 🗑️ Delete open tasks with automatic coin refund for unfilled slots

### For Admins:

- 👥 Manage all users — view, update roles, suspend/activate, delete accounts
- 📋 Manage all tasks — view details, block fraudulent or inappropriate tasks
- 📬 Process withdrawal requests — approve (deducts worker coins) or reject with notification
- 💵 View all platform payments with gateway breakdown and transaction details
- 📊 Advanced analytics dashboard with date range filtering (7d, 30d, 90d, custom)
- 📈 Revenue trend line chart, task volume bar chart, category split donut chart
- 🔁 Submission funnel visualization (submitted → approved → rejected → pending)
- 💳 Payment gateway breakdown showing revenue split across Stripe, bKash, SSLCommerz
- 🏆 Top workers by earnings in selected period
- 🧾 Recent payments feed with user, gateway, coins, and amount
- 🗂️ Category management
- 📋 Activity log for platform-wide event tracking
- 🩺 Platform health panel — coin circulation, pending withdrawals, pending submissions

---

## 🛠️ Tech Stack

### Frontend:

- **Framework**: Next.js 16 (App Router, Server Components, Route Handlers)
- **Language**: TypeScript (strict mode throughout)
- **Styling**: Tailwind CSS v4 + DaisyUI component library
- **State Management**: TanStack Query v5 (server/async state) + Redux Toolkit (UI state — sidebar, notification panel, modals)
- **Forms**: React Hook Form + Zod validation (client and server)
- **Animations**: Framer Motion (sidebar slide, page transitions) + GSAP (homepage scroll animations) + Lenis (smooth scroll)
- **Charts**: Recharts (revenue line chart in admin analytics)
- **Real-time**: Socket.io client (`socket.io-client`)
- **Notifications**: React Hot Toast + SweetAlert2 (confirmation dialogs)
- **Date utilities**: date-fns
- **Marquee**: react-fast-marquee (trusted brands section on homepage)
- **HTTP client**: Axios

### Backend:

- **Database**: MongoDB Atlas + Mongoose ODM
- **Authentication**: NextAuth.js v5 beta — Credentials provider (email/password) + Google OAuth
- **Session**: JWT sessions with custom callbacks to embed `id`, `role`, `coins` into session
- **Payment**: Stripe Checkout Sessions + Stripe Webhooks for payment confirmation
- **File Upload**: imgBB API (proxied through Next.js route handler)
- **Email**: Resend
- **Real-time server**: Separate Express + Socket.io server (deployed on Render)
- **API**: Next.js Route Handlers under `/api/v1/`
- **Password hashing**: bcryptjs

### Dev & Tooling:

- ESLint (Next.js config)
- TypeScript strict mode
- Vercel deployment (frontend)
- Render deployment (Socket.io server)

---

## 📁 Project Structure

```
taskhub/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx                        # Homepage (server component)
│   │   │   ├── tasks/page.tsx                  # Public task listing teaser
│   │   │   ├── leaderboard/page.tsx            # Top earners leaderboard
│   │   │   ├── how-it-works/page.tsx           # Platform explainer
│   │   │   ├── about/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── terms/page.tsx
│   │   │   ├── privacy/page.tsx
│   │   │   ├── support/page.tsx
│   │   │   └── layout.tsx                      # Public layout (Navbar + Footer)
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (worker)/
│   │   │   ├── worker/dashboard/page.tsx       # Stats, earnings chart, recent submissions
│   │   │   ├── worker/tasks/page.tsx           # Browse & filter tasks
│   │   │   ├── worker/tasks/[id]/page.tsx      # Task detail + submission form
│   │   │   ├── worker/submissions/page.tsx     # My submissions (paginated, filterable)
│   │   │   ├── worker/earnings/page.tsx        # Earnings portal + transaction history
│   │   │   ├── worker/withdrawals/page.tsx     # Withdrawal form + history
│   │   │   ├── worker/messages/page.tsx        # Real-time chat
│   │   │   ├── worker/profile/page.tsx         # Profile + stats + badges
│   │   │   ├── worker/settings/page.tsx
│   │   │   └── layout.tsx                      # Worker shell + auth guard
│   │   ├── (buyer)/
│   │   │   ├── buyer/dashboard/page.tsx        # Stats, task chart, pending submissions
│   │   │   ├── buyer/tasks/page.tsx            # My tasks table
│   │   │   ├── buyer/tasks/new/page.tsx        # Create task form
│   │   │   ├── buyer/tasks/[id]/page.tsx       # Task detail
│   │   │   ├── buyer/tasks/[id]/edit/page.tsx  # Edit task
│   │   │   ├── buyer/tasks/[id]/success/page.tsx
│   │   │   ├── buyer/submissions/page.tsx      # Review submissions (approve/reject)
│   │   │   ├── buyer/coins/page.tsx            # Purchase coins (Stripe/bKash/SSLCommerz)
│   │   │   ├── buyer/payments/page.tsx         # Payment history
│   │   │   ├── buyer/messages/page.tsx         # Real-time chat
│   │   │   ├── buyer/profile/page.tsx
│   │   │   └── layout.tsx                      # Buyer shell + auth guard
│   │   ├── (admin)/
│   │   │   ├── admin/dashboard/page.tsx        # Platform overview
│   │   │   ├── admin/users/page.tsx            # Manage users
│   │   │   ├── admin/tasks/page.tsx            # Manage tasks
│   │   │   ├── admin/submissions/page.tsx      # All submissions
│   │   │   ├── admin/withdrawals/page.tsx      # Process withdrawals
│   │   │   ├── admin/payments/page.tsx         # Platform payments
│   │   │   ├── admin/stats/page.tsx            # Advanced analytics
│   │   │   ├── admin/categories/page.tsx       # Category management
│   │   │   ├── admin/activity/page.tsx         # Activity log
│   │   │   └── layout.tsx                      # Admin shell + auth guard
│   │   └── api/v1/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── tasks/route.ts
│   │       ├── tasks/[id]/route.ts
│   │       ├── submissions/route.ts
│   │       ├── submissions/[id]/status/route.ts
│   │       ├── payments/packages/route.ts
│   │       ├── payments/create-session/route.ts
│   │       ├── payments/confirm/route.ts
│   │       ├── payments/stripe/webhook/route.ts
│   │       ├── withdrawals/route.ts
│   │       ├── withdrawals/[id]/approve/route.ts
│   │       ├── notifications/route.ts
│   │       ├── notifications/read-all/route.ts
│   │       ├── messages/route.ts
│   │       ├── messages/[conversationId]/route.ts
│   │       ├── admin/stats/route.ts
│   │       ├── admin/users/route.ts
│   │       ├── admin/users/[id]/route.ts
│   │       ├── admin/tasks/route.ts
│   │       └── uploads/imgbb/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.tsx                      # Public navbar
│   │   │   ├── Footer.tsx                      # Public footer
│   │   │   ├── Sidebar.tsx                     # Dashboard sidebar (worker/buyer/admin nav)
│   │   │   └── DashboardShell.tsx              # Dashboard wrapper with topbar
│   │   ├── ui/
│   │   │   ├── Badge.tsx                       # Status badge (pending/approved/rejected)
│   │   │   ├── Spinner.tsx
│   │   │   ├── Logo.tsx
│   │   │   ├── CountUp.tsx                     # Animated number counter
│   │   │   ├── StatsSection.tsx                # Homepage platform stats
│   │   │   ├── CoinPackageCards.tsx            # Homepage coin pricing cards
│   │   │   └── MarqueeBrands.tsx               # Trusted by marquee
│   │   ├── admin/
│   │   │   ├── StatsDateFilter.tsx             # Date range preset selector
│   │   │   ├── RevenueLineChart.tsx            # Recharts line chart
│   │   │   └── ...
│   │   ├── messages/
│   │   │   └── MessagesUI.tsx                  # Full chat UI (conversation list + chat panel)
│   │   ├── notifications/
│   │   │   └── NotificationBell.tsx            # Bell icon with unread badge + dropdown panel
│   │   └── shared/
│   │       └── StatCard.tsx                    # Reusable dashboard stat card
│   ├── lib/
│   │   ├── db.ts                               # Mongoose connection helper
│   │   ├── auth.ts                             # NextAuth config + session callbacks
│   │   ├── coins.ts                            # coinsToUsdWithdraw() utility
│   │   ├── constants.ts                        # COIN_PACKAGES, PAYMENT_GATEWAYS, MIN_WITHDRAWAL_COINS
│   │   ├── notifications.ts                    # createNotification() helper
│   │   ├── statsDateRange.ts                   # Date range resolver for admin analytics
│   │   └── validators/                         # Zod schemas (task, submission, withdrawal)
│   ├── models/
│   │   ├── User.ts
│   │   ├── Task.ts
│   │   ├── Submission.ts
│   │   ├── Payment.ts
│   │   ├── Withdrawal.ts
│   │   ├── Notification.ts
│   │   └── Message.ts
│   ├── store/
│   │   ├── index.ts                            # Redux store
│   │   └── uiSlice.ts                          # sidebarOpen, notificationPanelOpen
│   ├── hooks/
│   │   ├── useSocket.ts                        # Socket.io hook (send, receive, typing)
│   │   └── ...
│   └── types/
│       └── index.ts                            # IUser, ITask, ISubmission, IPayment, IWithdrawal, INotification, IMessage, IConversation
├── server/
│   └── index.js                                # Express + Socket.io server
├── requirements/
│   ├── requirement.md                          # Full feature spec
│   └── design.txt                             # HTML/Tailwind design mockups
└── public/
```

---

## 💬 Real-Time Messaging

TaskHub includes a full Socket.io powered messaging system between Workers and Buyers, scoped to individual tasks.

**Architecture:**

- A separate Express + Socket.io server runs independently (deployed on Render)
- The Next.js frontend connects via `socket.io-client` using a custom `useSocket` hook
- Conversations are identified by a `conversationId` derived from `taskId + buyerId + workerId`

**Features:**

- Conversation list sidebar showing all active chats with last message preview and unread count badge
- Real-time message delivery without page refresh
- Typing indicators — animated bouncing dots appear while the other user is typing, with 1.5s debounce
- Read receipts — single ✓ for sent, double ✓✓ for read
- Messages persist in MongoDB and are fetched via TanStack Query on conversation open
- Auto-scroll to latest message on new incoming messages
- Mobile-responsive — single panel toggle between conversation list and chat view
- Deep-link support — open a specific conversation directly via URL query params (`?conv=&taskId=&otherId=&otherName=`)
- Workers can open a chat from a task detail page; Buyers can open a chat from a submission review

**Socket events:**

- `send_message` — emit new message
- `receive_message` — receive incoming message
- `typing_start` / `typing_stop` — typing indicator events
- `mark_read` — mark conversation messages as read

---

## 🔔 Notification System

Notifications are created server-side whenever key events occur and delivered to the user's bell icon in the dashboard topbar.

**Triggers:**

- Worker submits proof → Buyer receives "New submission on [task]"
- Buyer approves submission → Worker receives "Your submission was approved, +X coins"
- Buyer rejects submission → Worker receives "Your submission was rejected"
- Admin approves withdrawal → Worker receives "Your withdrawal of X coins has been approved"
- Admin rejects withdrawal → Worker receives "Your withdrawal request was rejected"

**UI behaviour:**

- Bell icon shows red badge with unread count (capped at 9+)
- Clicking the bell opens a fixed dropdown panel positioned relative to the button
- Panel shows all notifications sorted newest first, unread items highlighted
- "Mark all read" button clears the badge
- Panel closes on outside click
- Polls every 30 seconds via TanStack Query `refetchInterval`
- Redux manages the open/close state of the panel (`notificationPanelOpen` in `uiSlice`)

---

## 💰 Coin Economy

The coin system is the core business model of TaskHub. It is intentionally asymmetric to generate platform revenue.

| Action                       | Rate                  |
| ---------------------------- | --------------------- |
| Buyer purchases coins        | 10 coins = $1 USD     |
| Worker withdraws coins       | 20 coins = $1 USD     |
| Minimum withdrawal threshold | 200 coins (≈ $10 USD) |
| New Worker signup bonus      | 10 coins              |
| New Buyer signup bonus       | 50 coins              |

**How the platform earns:**
The spread between the buy rate and the withdrawal rate is the platform fee. Example: a Buyer funds a task with 100 coins ($10). A Worker earns those 100 coins and withdraws them for $5. TaskHub keeps the $5 difference — no hidden fees, no commission taken from individual transactions.

**Coin Packages (Buyer purchase):**

| Package  | Coins | Price |
| -------- | ----- | ----- |
| Starter  | 10    | $1    |
| Basic    | 150   | $10   |
| Standard | 500   | $20   |
| Pro      | 1000  | $35   |

**Withdrawal flow:**

1. Worker navigates to `/worker/withdrawals`
2. Enters coin amount (min 200, max = current balance)
3. USD equivalent shown read-only (auto-calculated)
4. Selects payment method (Stripe / bKash / SSLCommerz)
5. Enters account/card number
6. SweetAlert2 confirmation dialog before submit
7. Withdrawal record created with `status: pending`
8. Admin reviews and approves/rejects from `/admin/withdrawals`
9. On approval: coins deducted from worker, notification sent
10. On rejection: notification sent with optional reason

---

## 💳 Payment Flow (Coin Purchase)

1. Buyer selects a coin package on `/buyer/coins`
2. Selects payment gateway (Stripe, bKash, or SSLCommerz)
3. POST to `/api/v1/payments/create-session` creates a Stripe Checkout Session
4. Buyer is redirected to Stripe's hosted checkout page
5. On success, Stripe redirects back to `/buyer/coins?success=true&paymentId=...`
6. Frontend POSTs to `/api/v1/payments/confirm` to credit coins
7. Stripe webhook at `/api/v1/payments/stripe/webhook` also handles confirmation (idempotent)
8. Payment record saved to MongoDB with gateway, coins, amount, transaction ID, and status
9. Session updated to reflect new coin balance

---

## 🗄️ Database Schema

**User**

```
name, email, passwordHash, photoUrl
role: "worker" | "buyer" | "admin"
coins: Number
status: "active" | "suspended"
createdAt, updatedAt
```

**Task**

```
title, details, category
buyerId, buyerName, buyerEmail
requiredWorkers, filledWorkers
payableAmount (coins per worker)
completionDate
submissionInfo (instructions)
imageUrl
status: "open" | "closed" | "blocked" | "archived"
createdAt, updatedAt
```

**Submission**

```
taskId, taskTitle, taskBuyerId, taskBuyerName
workerId, workerName, workerEmail
payableAmount
details, proofLinks[], proofImageUrl
status: "pending" | "approved" | "rejected"
createdAt, updatedAt
```

**Payment**

```
userId, userEmail
gateway: "stripe" | "bkash" | "sslcommerz"
coinsPurchased, amount, currency
status: "pending" | "success" | "failed"
gatewayTransactionId, meta
createdAt, updatedAt
```

**Withdrawal**

```
workerId, workerName, workerEmail
coinRequested, amount (USD)
paymentSystem, accountNumber
status: "pending" | "approved" | "rejected"
processedAt
createdAt, updatedAt
```

**Notification**

```
toUserId, toEmail
message, actionRoute
type: "info" | "success" | "warning"
isRead: Boolean
createdAt
```

**Message**

```
conversationId, taskId
senderId, senderName
receiverId, receiverName
content
isRead: Boolean
createdAt
```

---

## 🔐 Authentication & Authorization

**Providers:**

- Google OAuth — one-click login for all roles
- Credentials — email + bcryptjs hashed password

**Session:**

- NextAuth v5 JWT sessions
- Custom `jwt` and `session` callbacks embed `id`, `role`, and `coins` into `session.user`
- Session updated after coin purchases and withdrawals via `update()` from `useSession`

**Route protection:**

- Each role layout (`(worker)`, `(buyer)`, `(admin)`) calls `auth()` server-side and redirects unauthorized users
- All API route handlers verify session and enforce role checks before any DB operation
- Authenticated users are redirected away from `/login` and `/register`

**Registration flow:**

1. User selects role (Worker or Buyer) on step 1
2. Fills name, email, password, optional profile photo URL on step 2
3. Zod validates on client; server re-validates before writing to DB
4. User created with role-appropriate coin bonus (Worker: 10, Buyer: 50)
5. NextAuth auto-signs in and redirects to the correct dashboard

---

## 🔌 API Reference

### Auth

```
POST  /api/auth/[...nextauth]     NextAuth handler (login, OAuth callback, session)
```

### Tasks

```
GET    /api/v1/tasks               List tasks (public browse, with filters)
POST   /api/v1/tasks               Create task (buyer only, deducts coins)
GET    /api/v1/tasks/[id]          Get single task
PUT    /api/v1/tasks/[id]          Update task (buyer only)
DELETE /api/v1/tasks/[id]          Delete task + refund coins (buyer only)
```

### Submissions

```
GET   /api/v1/submissions                    List submissions (worker: mine | buyer: for my tasks)
POST  /api/v1/submissions                    Create submission (worker only)
POST  /api/v1/submissions/[id]/status        Approve or reject (buyer only)
```

### Payments

```
GET   /api/v1/payments/packages              List coin packages
POST  /api/v1/payments/create-session        Create Stripe Checkout session
POST  /api/v1/payments/confirm               Confirm payment and credit coins
POST  /api/v1/payments/stripe/webhook        Stripe webhook handler
```

### Withdrawals

```
GET   /api/v1/withdrawals                    List my withdrawals (worker)
POST  /api/v1/withdrawals                    Create withdrawal request (worker)
POST  /api/v1/withdrawals/[id]/approve       Approve or reject (admin)
```

### Notifications

```
GET   /api/v1/notifications                  List my notifications
POST  /api/v1/notifications/read-all         Mark all as read
```

### Messages

```
GET   /api/v1/messages                       List my conversations
GET   /api/v1/messages/[conversationId]      Get messages in a conversation
POST  /api/v1/messages                       Send a message
```

### Admin

```
GET    /api/v1/admin/stats                   Platform analytics (date-range filterable)
GET    /api/v1/admin/users                   List all users
PUT    /api/v1/admin/users/[id]              Update user role or status
DELETE /api/v1/admin/users/[id]              Delete user
GET    /api/v1/admin/tasks                   List all tasks
```

### Uploads

```
POST  /api/v1/uploads/imgbb                  Proxy image upload to imgBB API
```

---

## 📱 Pages — Full List

### Public:

| Route           | Description                                                                             |
| --------------- | --------------------------------------------------------------------------------------- |
| `/`             | Homepage — hero, how it works, stats, coin economy, top workers, testimonials, FAQ, CTA |
| `/tasks`        | Public task listing teaser                                                              |
| `/leaderboard`  | Top 20 workers by approved coins — podium for top 3, full rankings table                |
| `/how-it-works` | Step-by-step guide for Workers and Buyers, coin economy explainer, payment methods      |
| `/about`        | About the platform                                                                      |
| `/faq`          | Frequently asked questions                                                              |
| `/terms`        | Terms of service                                                                        |
| `/privacy`      | Privacy policy                                                                          |
| `/support`      | Support contact                                                                         |

### Auth:

| Route              | Description                                          |
| ------------------ | ---------------------------------------------------- |
| `/login`           | Email/password + Google OAuth login                  |
| `/register`        | 2-step registration — choose role, then fill details |
| `/forgot-password` | Request password reset email                         |
| `/reset-password`  | Set new password via token                           |

### Worker Dashboard:

| Route                 | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `/worker/dashboard`   | Stats cards, 7-day earnings bar chart, performance panel, recent submissions, quick links |
| `/worker/tasks`       | Browse tasks with search, category filter, min payout filter, sort by payout/deadline     |
| `/worker/tasks/[id]`  | Task detail — full description, buyer info, slots remaining, deadline, submission form    |
| `/worker/submissions` | All my submissions — paginated, filterable by status, with status badges                  |
| `/worker/earnings`    | Earnings portal — balance cards, full transaction history (earnings + withdrawals)        |
| `/worker/withdrawals` | Withdrawal form + history table                                                           |
| `/worker/messages`    | Real-time chat — conversation list + chat panel                                           |
| `/worker/profile`     | Profile with stats and badges                                                             |
| `/worker/settings`    | Account settings                                                                          |

### Buyer Dashboard:

| Route                       | Description                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `/buyer/dashboard`          | Stats cards, 7-day task activity chart, overview panel, pending submissions list, quick links |
| `/buyer/tasks`              | My tasks table — title, status, workers, payout, deadline, actions                            |
| `/buyer/tasks/new`          | Create task form — all fields with coin cost preview                                          |
| `/buyer/tasks/[id]`         | Task detail view                                                                              |
| `/buyer/tasks/[id]/edit`    | Edit task fields                                                                              |
| `/buyer/tasks/[id]/success` | Post-creation success page                                                                    |
| `/buyer/submissions`        | Review pending submissions — view proof, approve or reject                                    |
| `/buyer/coins`              | Purchase coins — gateway selector + 4 package cards                                           |
| `/buyer/payments`           | Payment history table                                                                         |
| `/buyer/messages`           | Real-time chat — conversation list + chat panel                                               |
| `/buyer/profile`            | Profile page                                                                                  |

### Admin Dashboard:

| Route                | Description                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/dashboard`   | Platform overview — user counts, task counts, revenue, recent activity                                                                         |
| `/admin/users`       | Manage all users — filter by role/status, update role, suspend, delete                                                                         |
| `/admin/tasks`       | Manage all tasks — filter, view, block                                                                                                         |
| `/admin/submissions` | All platform submissions                                                                                                                       |
| `/admin/withdrawals` | Pending withdrawal requests — approve or reject                                                                                                |
| `/admin/payments`    | All platform payments                                                                                                                          |
| `/admin/stats`       | Advanced analytics — KPI cards, revenue chart, task volume, category split, submission funnel, gateway breakdown, top workers, recent payments |
| `/admin/categories`  | Category management                                                                                                                            |
| `/admin/activity`    | Platform activity log                                                                                                                          |
