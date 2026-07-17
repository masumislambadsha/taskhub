import { useState, useRef, useEffect } from "react";
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, COIN_PACKAGES } from "../../src/lib/constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const HOW_WORKERS = [
  { icon: "search", title: "Browse Curated Tasks", desc: "Access a personalized feed of micro-tasks that match your skill profile and availability." },
  { icon: "checkmark-circle", title: "Execute & Submit", desc: "Follow clear guidelines to complete tasks. Our interface makes documentation seamless." },
  { icon: "cash", title: "Withdraw Earnings", desc: "Cash out your coins via Stripe, bKash, or SSLCommerz whenever you want." },
];

const HOW_BUYERS = [
  { icon: "add-circle", title: "Define Your Scope", desc: "Post tasks with specific requirements, quality thresholds, and target demographics." },
  { icon: "star", title: "Review Submissions", desc: "Approve or reject worker submissions with one click. Full control over quality." },
  { icon: "analytics", title: "Scale Operations", desc: "Reach thousands of completions per day with our distributed workforce." },
];

const WORKER_FEATURES = [
  { icon: "shield-checkmark", title: "Secure Payments", desc: "Our escrow system ensures you get paid for every approved task, with instant withdrawals to multiple providers." },
  { icon: "calendar", title: "Total Flexibility", desc: "Choose tasks that fit your schedule. No minimum hours, no long-term commitments, just pure execution." },
  { icon: "trending-up", title: "Skill Progression", desc: "Higher ratings unlock higher-paying, exclusive tasks. Build your reputation in the marketplace." },
];

const BUYER_FEATURES = [
  { icon: "speedometer", title: "Unmatched Speed", desc: "Tasks are picked up in seconds. Reach 10,000 completions per day with our distributed workforce." },
  { icon: "checkmark-done", title: "Quality Assurance", desc: "Built-in consensus algorithms and manual audit tools ensure only the highest quality data enters your system." },
  { icon: "code-slash", title: "Full API Access", desc: "Automate task creation and result ingestion. Integrate TaskHub directly into your existing data pipelines." },
];

const FAQ_ITEMS = [
  { q: "How do I withdraw my earnings?", a: "You can withdraw your earnings as soon as your balance reaches the minimum threshold of 200 coins. We support bKash and SSLCommerz. Payments are processed within 24 hours." },
  { q: "What kind of tasks are available?", a: "Tasks range from data labeling, content moderation, surveys, image annotation, writing & reviews, app testing, social media engagement, and research. New task types are added regularly." },
  { q: "How does the coin system work?", a: "Buyers purchase coins at 10 coins per $1. Workers earn coins by completing approved tasks and can withdraw at a rate of 20 coins per $1. The difference is TaskHub's platform fee." },
  { q: "How is quality maintained?", a: "We use a combination of buyer review, worker reputation scores, and submission proof requirements to ensure high-quality work. Buyers can reject low-quality submissions." },
  { q: "Is there a limit to how much I can earn?", a: "No limits. The more tasks you complete with high approval rates, the more you earn. Top workers earn thousands of dollars monthly." },
  { q: "How do I get started as a buyer?", a: "Register as a buyer, purchase coins, and post your first task in minutes. Set your payout per worker, deadline, and submission requirements." },
  { q: "What happens if a submission is rejected?", a: "Rejected submissions do not cost the buyer any coins. Workers receive feedback and can improve their approach on future tasks." },
  { q: "Is my payment information secure?", a: "Yes. All payments are processed through trusted gateways. We never store your full card details. Transactions are encrypted end-to-end." },
];

function AccordionItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const animHeight = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toVal = open ? 0 : 1;
    Animated.timing(animHeight, { toValue: toVal, duration: 300, useNativeDriver: false }).start();
    setOpen(!open);
  };

  return (
    <View style={faqStyles.item}>
      <TouchableOpacity style={faqStyles.summary} onPress={toggle} activeOpacity={0.7}>
        <View style={faqStyles.summaryLeft}>
          <View style={[faqStyles.number, open && faqStyles.numberOpen]}>
            <Text style={[faqStyles.numberText, open && faqStyles.numberTextOpen]}>01</Text>
          </View>
          <Text style={faqStyles.question}>{q}</Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={COLORS.text} style={{ opacity: 0.3, transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
      </TouchableOpacity>
      {open && (
        <View style={faqStyles.answerWrap}>
          <Text style={faqStyles.answer}>{a}</Text>
        </View>
      )}
    </View>
  );
}

const faqStyles = StyleSheet.create({
  item: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: "#0040300D", borderRadius: 16, marginBottom: 8, overflow: "hidden" },
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  number: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#4A97821A", justifyContent: "center", alignItems: "center" },
  numberOpen: { backgroundColor: COLORS.primary },
  numberText: { fontSize: 11, fontWeight: "800", color: COLORS.secondary },
  numberTextOpen: { color: COLORS.white },
  question: { fontSize: 15, fontWeight: "700", color: COLORS.text, flex: 1 },
  answerWrap: { paddingHorizontal: 20, paddingBottom: 16, paddingLeft: 60 },
  answer: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, lineHeight: 20, borderTopWidth: 1, borderTopColor: "#0040300D", paddingTop: 12 },
});

export default function LandingPage() {
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

  const handleRegister = (role: string) => {
    router.push(`/(auth)/register?role=${role}`);
  };

  return (
    <ScrollView style={st.screen} showsVerticalScrollIndicator={false}>
      {/* SECTION 1: HERO */}
      <View style={st.hero}>
        <View style={st.heroText}>
          <Text style={st.heroTitle}>
            Earn from micro tasks or{" "}
            <Text style={st.heroTitleAccent}>get work done faster</Text>
          </Text>
          <Text style={st.heroSub}>
            The premium marketplace for precise execution. Join thousands of workers and buyers in a curated ecosystem built for efficiency.
          </Text>
          <View style={st.heroCta}>
            <TouchableOpacity style={st.ctaPrimary} onPress={() => handleRegister("worker")} activeOpacity={0.9}>
              <Text style={st.ctaPrimaryText}>Start earning</Text>
              <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
            </TouchableOpacity>
            <TouchableOpacity style={st.ctaOutline} onPress={() => handleRegister("buyer")} activeOpacity={0.9}>
              <Text style={st.ctaOutlineText}>Post a task</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mock Dashboard */}
        <View style={st.mockDashboard}>
          <View style={st.mockBgGlow} />
          <View style={st.mockCard}>
            <View style={st.mockSidebar}>
              <View style={st.mockSidebarLogo}><Text style={st.mockSidebarLogoText}>T</Text></View>
              <View style={st.mockSidebarIcons}>
                <View style={st.mockIconActive}><Ionicons name="grid" size={14} color={COLORS.white} /></View>
                <View style={st.mockIcon}><Ionicons name="search" size={14} color="rgba(255,255,255,0.6)" /></View>
                <View style={st.mockIcon}><Ionicons name="document" size={14} color="rgba(255,255,255,0.6)" /></View>
              </View>
            </View>
            <View style={st.mockContent}>
              <View style={st.mockHeader}>
                <View>
                  <Text style={st.mockGreeting}>Good morning,</Text>
                  <Text style={st.mockName}>Alex Johnson</Text>
                </View>
                <View style={st.mockCoinBadge}>
                  <Ionicons name="diamond" size={14} color="#F59E0B" />
                  <Text style={st.mockCoinText}>1,240</Text>
                </View>
              </View>
              <View style={st.mockStats}>
                <View style={st.mockStat}>
                  <Text style={st.mockStatLabel}>Tasks Done</Text>
                  <Text style={st.mockStatValue}>38</Text>
                  <Text style={st.mockStatUp}>↑ 4 this week</Text>
                </View>
                <View style={st.mockStat}>
                  <Text style={st.mockStatLabel}>Earned</Text>
                  <Text style={[st.mockStatValue, { color: COLORS.secondary }]}>620 <Text style={{ fontSize: 11, fontWeight: "400", color: "#94A3B8" }}>coins</Text></Text>
                  <Text style={st.mockStatSub}>≈ $31.00</Text>
                </View>
              </View>
              <View style={st.mockTask}>
                <View style={st.mockTaskTop}>
                  <Text style={st.mockTaskTitle}>Write a 5-star product review</Text>
                  <View style={st.mockTaskBadge}><Text style={st.mockTaskBadgeText}>+20 coins</Text></View>
                </View>
                <Text style={st.mockTaskDesc}>Take a screenshot of your review and submit proof.</Text>
                <View style={st.mockTaskBottom}>
                  <Text style={st.mockTaskSlots}>2 of 50 slots left</Text>
                  <TouchableOpacity style={st.mockTaskBtn}><Text style={st.mockTaskBtnText}>Start Task</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 2: TRUSTED BY */}
      <View style={st.trusted}>
        <Text style={st.trustedLabel}>TRUSTED BY:</Text>
        <View style={st.brandsRow}>
          {["TechCorp", "DataFlow", "AILabs", "CloudSync", "NexGen", "PixelWorks"].map((b) => (
            <View key={b} style={st.brandItem}>
              <Text style={st.brandText}>{b}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SECTION 3: HOW IT WORKS */}
      <View style={st.section}>
        <View style={st.sectionCenter}>
          <Text style={st.sectionTitle}>Precision Engineering for Every Workflow</Text>
          <Text style={st.sectionSub}>Whether you're looking to complete micro-tasks or scale your operations, TaskHub provides the infrastructure.</Text>
        </View>
        <View style={st.howGrid}>
          <View style={st.howCol}>
            <View style={st.howDivider}>
              <View style={st.dividerLine} />
              <Text style={st.howLabel}>FOR WORKERS</Text>
            </View>
            {HOW_WORKERS.map((item) => (
              <View key={item.title} style={st.howCard}>
                <View style={st.howIconWrap}>
                  <Ionicons name={item.icon as any} size={20} color={COLORS.secondary} />
                </View>
                <View style={st.howCardContent}>
                  <Text style={st.howCardTitle}>{item.title}</Text>
                  <Text style={st.howCardDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={st.howCol}>
            <View style={st.howDivider}>
              <View style={[st.dividerLine, { backgroundColor: COLORS.primary }]} />
              <Text style={st.howLabel}>FOR BUYERS</Text>
            </View>
            {HOW_BUYERS.map((item) => (
              <View key={item.title} style={st.howCardBuyer}>
                <View style={st.howIconWrapBuyer}>
                  <Ionicons name={item.icon as any} size={20} color={COLORS.secondary} />
                </View>
                <View style={st.howCardContent}>
                  <Text style={[st.howCardTitle, { color: COLORS.white }]}>{item.title}</Text>
                  <Text style={[st.howCardDesc, { color: "rgba(255,255,255,0.7)" }]}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 4: STATS */}
      <View style={st.statsSection}>
        <View style={st.statsGrid}>
          {[
            { value: "450K+", label: "WORKERS REGISTERED" },
            { value: "1.2M+", label: "TASKS COMPLETED" },
            { value: "$15M+", label: "USD PAID OUT" },
            { value: "99.8%", label: "SUCCESS RATE" },
          ].map((item) => (
            <View key={item.label} style={st.statItem}>
              <Text style={st.statValue}>{item.value}</Text>
              <Text style={st.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SECTION 5: WORKER FEATURES */}
      <View style={st.section}>
        <View style={st.featureRow}>
          <View style={st.featureText}>
            <View style={st.featureBadge}><Text style={st.featureBadgeText}>EMPOWERING TALENT</Text></View>
            <Text style={st.sectionTitle}>Work on your terms, get paid for your precision</Text>
            {WORKER_FEATURES.map((f) => (
              <View key={f.title} style={st.featureItem}>
                <Ionicons name={f.icon as any} size={20} color={COLORS.secondary} style={{ marginTop: 2 }} />
                <View style={st.featureItemContent}>
                  <Text style={st.featureItemTitle}>{f.title}</Text>
                  <Text style={st.featureItemDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={st.featureVisual}>
            <View style={st.withdrawCard}>
              <View style={st.withdrawBgIcon}>
                <Ionicons name="cash" size={60} color={COLORS.accent} style={{ opacity: 0.1 }} />
              </View>
              <View style={st.withdrawHeader}>
                <View style={st.withdrawAvatar}><Text style={st.withdrawAvatarText}>M</Text></View>
                <View>
                  <Text style={st.withdrawName}>Maria S.</Text>
                  <Text style={st.withdrawLevel}>Top Contributor · Level 4</Text>
                </View>
                <View style={st.withdrawStatus}><Text style={st.withdrawStatusText}>Active</Text></View>
              </View>
              {[
                { task: "Image labeling batch #48", reward: "$1.20", status: "Approved" },
                { task: "Sentiment analysis · 20 items", reward: "$2.50", status: "Approved" },
                { task: "Audio transcription clip", reward: "$0.80", status: "Pending" },
              ].map((t) => (
                <View key={t.task} style={st.withdrawRow}>
                  <Text style={st.withdrawTask} numberOfLines={1}>{t.task}</Text>
                  <View style={st.withdrawRight}>
                    <Text style={st.withdrawReward}>{t.reward}</Text>
                    <View style={[st.statusBadge, t.status === "Approved" ? st.statusApproved : st.statusPending]}>
                      <Text style={[st.statusText, t.status === "Approved" ? st.statusTextApproved : st.statusTextPending]}>{t.status}</Text>
                    </View>
                  </View>
                </View>
              ))}
              <View style={st.withdrawDivider} />
              <View style={st.withdrawEarnings}>
                <Text style={st.withdrawEarningsLabel}>Earnings this week</Text>
                <Text style={st.withdrawEarningsValue}>$342.50</Text>
              </View>
              <TouchableOpacity style={st.withdrawBtn} onPress={() => handleRegister("worker")} activeOpacity={0.9}>
                <Text style={st.withdrawBtnText}>Withdraw Funds</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 6: BUYER FEATURES */}
      <View style={[st.section, { backgroundColor: COLORS.white }]}>
        <View style={[st.featureRow, { flexDirection: "column-reverse" as any }]}>
          <View style={[st.featureVisual, { marginTop: 24 }]}>
            <View style={st.buyerScaleCard}>
              <View style={st.buyerScaleHeader}>
                <Text style={st.buyerScaleLabel}>REAL-TIME OPERATIONS</Text>
                <View style={st.buyerScaleLive}>
                  <View style={st.buyerScaleDot} />
                  <Text style={st.buyerScaleLiveText}>Live</Text>
                </View>
              </View>
              <View style={st.buyerChart}>
                {[20, 40, 80, 60, 90, 50].map((h, i) => (
                  <View key={i} style={[st.buyerBar, { height: `${h}%` }, (i === 2 || i === 4) && st.buyerBarActive]} />
                ))}
              </View>
              <View style={st.buyerStatsRow}>
                <View style={st.buyerStatItem}>
                  <Text style={st.buyerStatLabel}>ACTIVE WORKERS</Text>
                  <Text style={st.buyerStatValue}>8,294</Text>
                </View>
                <View style={st.buyerStatItem}>
                  <Text style={st.buyerStatLabel}>COST PER TASK</Text>
                  <Text style={st.buyerStatValue}>$0.02</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={st.featureText}>
            <View style={[st.featureBadge, { backgroundColor: "#0040300D" }]}>
              <Text style={[st.featureBadgeText, { color: COLORS.primary }]}>FOR BUSINESS SCALE</Text>
            </View>
            <Text style={st.sectionTitle}>Deploy micro-tasks at global scale with zero friction</Text>
            {BUYER_FEATURES.map((f) => (
              <View key={f.title} style={st.featureItem}>
                <Ionicons name={f.icon as any} size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
                <View style={st.featureItemContent}>
                  <Text style={st.featureItemTitle}>{f.title}</Text>
                  <Text style={st.featureItemDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 7: COIN ECONOMY */}
      <View style={st.section}>
        <View style={st.coinRow}>
          <View style={st.coinText}>
            <View style={st.featureBadge}><Text style={st.featureBadgeText}>COIN ECONOMY</Text></View>
            <Text style={st.sectionTitle}>Simple, transparent pricing</Text>
            <View style={st.coinBullets}>
              <View style={st.coinBullet}>
                <Ionicons name="diamond" size={18} color={COLORS.secondary} />
                <Text style={st.coinBulletText}><Text style={{ fontWeight: "700" }}>Buyers</Text> purchase 10 coins for $1 USD.</Text>
              </View>
              <View style={st.coinBullet}>
                <Ionicons name="cash" size={18} color={COLORS.secondary} />
                <Text style={st.coinBulletText}><Text style={{ fontWeight: "700" }}>Workers</Text> withdraw $1 USD per 20 coins earned.</Text>
              </View>
              <View style={st.coinBullet}>
                <Ionicons name="information-circle" size={18} color={COLORS.secondary} />
                <Text style={st.coinBulletText}>The spread between buy and withdraw rates sustains the platform.</Text>
              </View>
            </View>
          </View>
          <View style={st.packagesGrid}>
            {COIN_PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[st.pkgCard, selectedPkg === pkg.id && st.pkgCardSelected]}
                onPress={() => setSelectedPkg(pkg.id === selectedPkg ? null : pkg.id)}
                activeOpacity={0.8}
              >
                {pkg.popular && <View style={st.popularBadge}><Text style={st.popularBadgeText}>POPULAR</Text></View>}
                <Text style={[st.pkgLabel, selectedPkg === pkg.id && st.pkgLabelSelected]}>{pkg.label}</Text>
                <Text style={[st.pkgCoins, selectedPkg === pkg.id && st.pkgCoinsSelected]}>{pkg.coins.toLocaleString()}</Text>
                <Text style={[st.pkgCoinsLabel, selectedPkg === pkg.id && st.pkgCoinsLabelSelected]}>coins</Text>
                <Text style={st.pkgPrice}>${pkg.price.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 8: ELITE CONTRIBUTORS */}
      <View style={[st.section, { borderTopWidth: 1, borderTopColor: "#0040300D" }]}>
        <View style={st.eliteHeader}>
          <View>
            <Text style={st.sectionTitle}>Elite Contributors</Text>
            <Text style={st.eliteSub}>Recognizing our highest-performing task masters this month.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(public)/leaderboard")}>
            <Text style={st.eliteLink}>View leaderboard <Ionicons name="arrow-forward" size={14} color={COLORS.secondary} /></Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.eliteScroll}>
          {[
            { name: "Alex Rodriguez", coins: 12450, approval: "99.2%" },
            { name: "Sarah Chen", coins: 10820, approval: "98.7%" },
            { name: "Priya Sharma", coins: 9450, approval: "100%" },
            { name: "James Wilson", coins: 8900, approval: "97.5%" },
            { name: "Aisha Patel", coins: 7600, approval: "99.1%" },
            { name: "Lucas Kim", coins: 7200, approval: "96.8%" },
          ].map((w) => (
            <View key={w.name} style={st.eliteCard}>
              <View style={st.eliteCardTop}>
                <View style={st.eliteAvatar}>
                  <Text style={st.eliteAvatarText}>{w.name[0]}</Text>
                </View>
                <View style={st.eliteVerified}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.secondary} />
                </View>
              </View>
              <Text style={st.eliteName}>{w.name}</Text>
              <View style={st.eliteStats}>
                <View style={st.eliteStat}>
                  <Text style={st.eliteStatLabel}>COINS EARNED</Text>
                  <View style={st.eliteStatRow}><Ionicons name="diamond" size={12} color="#F59E0B" /><Text style={st.eliteStatValue}>{w.coins.toLocaleString()}</Text></View>
                </View>
                <View style={st.eliteStat}>
                  <Text style={st.eliteStatLabel}>APPROVED</Text>
                  <Text style={[st.eliteStatValue, { color: COLORS.secondary }]}>{w.approval}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* SECTION 9: COMMUNITY VOICE */}
      <View style={st.section}>
        <View style={st.testimonialRow}>
          <View style={st.testimonialLeft}>
            <Text style={st.testimonialQuoteMark}>"</Text>
            <Text style={st.testimonialTitle}>Community Voice</Text>
            <Text style={st.testimonialQuote}>"TaskHub transformed our data annotation process. We scaled from 100 to 10,000 labels a day without sacrificing quality."</Text>
            <View style={st.testimonialAuthor}>
              <View style={st.testimonialAvatar}><Text style={st.testimonialAvatarText}>M</Text></View>
              <View>
                <Text style={st.testimonialAuthorName}>Marcus Thorne</Text>
                <Text style={st.testimonialAuthorRole}>HEAD OF AI AT DATASTREAM</Text>
              </View>
            </View>
          </View>
          <View style={st.testimonialRight}>
            <View style={st.testimonialCard}>
              <View style={st.starsRow}>
                {[1, 2, 3, 4, 5].map((i) => (<Ionicons key={i} name="star" size={16} color="#FBBF24" />))}
              </View>
              <Text style={st.testimonialCardQuote}>"Consistent payouts and a clean interface. Best micro-task platform I've used."</Text>
              <Text style={st.testimonialCardAuthor}>Elena Petrova · <Text style={{ color: "#00403066" }}>Verified Task Master</Text></Text>
            </View>
            <View style={st.testimonialCard}>
              <Ionicons name="flash" size={20} color={COLORS.secondary} />
              <Text style={st.testimonialCardQuote}>"Lightning fast turnaround on our marketing outreach tasks. What used to take a week now takes four hours."</Text>
              <Text style={st.testimonialCardAuthor}>David Chen · <Text style={{ color: "#00403066" }}>Startup Founder</Text></Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 10: GLOBAL IMPACT */}
      <View style={st.impactSection}>
        <Text style={st.impactTitle}>Global Impact, Local Empowerment</Text>
        <Text style={st.impactDesc}>TaskHub isn't just a platform; it's a movement providing fair-wage opportunities to individuals in 140+ countries.</Text>
        <View style={st.impactGrid}>
          {[
            { value: "140+", label: "COUNTRIES", icon: "🌍" },
            { value: "12ms", label: "TASK LATENCY", icon: "⚡" },
            { value: "0%", label: "PAYMENT FEES", icon: "💸" },
          ].map((item) => (
            <View key={item.label} style={st.impactCard}>
              <Text style={st.impactIcon}>{item.icon}</Text>
              <Text style={st.impactValue}>{item.value}</Text>
              <Text style={st.impactLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SECTION 11: FAQ */}
      <View style={st.section}>
        <View style={st.faqRow}>
          <View style={st.faqLeft}>
            <View style={st.faqBadge}><Text style={st.faqBadgeText}>GOT QUESTIONS?</Text></View>
            <Text style={st.faqTitle}>Everything you need to know.</Text>
            <Text style={st.faqDesc}>Can't find the answer you're looking for? Reach out to our support team.</Text>
            <TouchableOpacity style={st.faqBtn} onPress={() => router.push("/(public)/support")}>
              <Ionicons name="help-buoy" size={16} color={COLORS.white} />
              <Text style={st.faqBtnText}>Visit Support Hub</Text>
            </TouchableOpacity>
          </View>
          <View style={st.faqRight}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={item.q} q={item.q} a={item.a} defaultOpen={i === 0} />
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 12: FINAL CTA */}
      <View style={st.ctaSection}>
        <View style={st.ctaGlow1} />
        <View style={st.ctaGlow2} />
        <Text style={st.ctaTitle}>Ready to redefine how you work?</Text>
        <Text style={st.ctaDesc}>Join the most efficient micro-tasking network today. Signing up takes less than 2 minutes.</Text>
        <View style={st.ctaRow}>
          <TouchableOpacity style={st.ctaSecondary} onPress={() => handleRegister("worker")} activeOpacity={0.9}>
            <Text style={st.ctaSecondaryText}>Get Started Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.ctaGhost} onPress={() => router.push("/(public)/browse-tasks")} activeOpacity={0.9}>
            <Text style={st.ctaGhostText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },

  // HERO
  hero: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, maxWidth: 1200, width: "100%", alignSelf: "center" },
  heroText: { marginBottom: 32 },
  heroTitle: { fontSize: 32, lineHeight: 38, fontWeight: "800", color: COLORS.primary, letterSpacing: -0.5 },
  heroTitleAccent: { color: COLORS.secondary },
  heroSub: { fontSize: 16, lineHeight: 24, color: COLORS.textSecondary, opacity: 0.7, marginTop: 16, fontWeight: "300" },
  heroCta: { flexDirection: "row", gap: 12, marginTop: 20 },
  ctaPrimary: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  ctaPrimaryText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  ctaOutline: { borderWidth: 2, borderColor: COLORS.secondary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 10, justifyContent: "center" },
  ctaOutlineText: { color: COLORS.primary, fontSize: 16, fontWeight: "700" },

  // MOCK DASHBOARD
  mockDashboard: { position: "relative", marginTop: 8 },
  mockBgGlow: { position: "absolute", top: -8, left: -8, right: -8, bottom: -8, backgroundColor: "rgba(74,151,130,0.08)", borderRadius: 32 },
  mockCard: { backgroundColor: COLORS.white, borderRadius: 12, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 12, flexDirection: "row", borderWidth: 1, borderColor: "#0040300D" },
  mockSidebar: { width: 48, backgroundColor: COLORS.primary, paddingVertical: 16, alignItems: "center" },
  mockSidebarLogo: { width: 28, height: 28, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", marginBottom: 20 },
  mockSidebarLogoText: { color: COLORS.white, fontSize: 10, fontWeight: "800" },
  mockSidebarIcons: { gap: 12, alignItems: "center" },
  mockIconActive: { width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.4)", justifyContent: "center", alignItems: "center" },
  mockIcon: { width: 24, height: 24, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  mockContent: { flex: 1, padding: 12, backgroundColor: "#F8FAFC" },
  mockHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  mockGreeting: { fontSize: 11, color: "#94A3B8" },
  mockName: { fontSize: 14, fontWeight: "600", color: COLORS.primary },
  mockCoinBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  mockCoinText: { fontSize: 13, fontWeight: "700", color: "#D97706" },
  mockStats: { flexDirection: "row", gap: 8, marginBottom: 12 },
  mockStat: { flex: 1, backgroundColor: COLORS.white, borderRadius: 8, padding: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1, borderWidth: 1, borderColor: "#F1F5F9" },
  mockStatLabel: { fontSize: 11, color: "#94A3B8", marginBottom: 4 },
  mockStatValue: { fontSize: 18, fontWeight: "700", color: COLORS.primary },
  mockStatUp: { fontSize: 11, color: "#10B981", marginTop: 2 },
  mockStatSub: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  mockTask: { backgroundColor: COLORS.white, borderRadius: 8, padding: 10, borderLeftWidth: 4, borderLeftColor: COLORS.secondary, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  mockTaskTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  mockTaskTitle: { fontSize: 12, fontWeight: "600", color: COLORS.primary, flex: 1 },
  mockTaskBadge: { backgroundColor: "rgba(74,151,130,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  mockTaskBadgeText: { fontSize: 10, color: COLORS.secondary, fontWeight: "600" },
  mockTaskDesc: { fontSize: 11, color: "#94A3B8", marginBottom: 8 },
  mockTaskBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mockTaskSlots: { fontSize: 11, color: "#94A3B8" },
  mockTaskBtn: { backgroundColor: COLORS.secondary, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  mockTaskBtnText: { fontSize: 11, color: COLORS.white, fontWeight: "600" },

  // TRUSTED
  trusted: { paddingHorizontal: 16, paddingVertical: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#0040300D", overflow: "hidden" },
  trustedLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "#00403066", marginBottom: 12 },
  brandsRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  brandItem: { backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: "#0040300D" },
  brandText: { fontSize: 12, fontWeight: "600", color: COLORS.textSecondary, opacity: 0.5 },

  // SECTIONS
  section: { paddingHorizontal: 16, paddingVertical: 32, maxWidth: 1200, width: "100%", alignSelf: "center" },
  sectionCenter: { alignItems: "center", marginBottom: 32 },
  sectionTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginBottom: 12, letterSpacing: -0.3 },
  sectionSub: { fontSize: 15, color: COLORS.textSecondary, opacity: 0.6, textAlign: "center", lineHeight: 22, maxWidth: 500 },

  // HOW IT WORKS
  howGrid: { gap: 24 },
  howCol: { gap: 12 },
  howDivider: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 4 },
  dividerLine: { width: 40, height: 2, backgroundColor: COLORS.secondary },
  howLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: COLORS.primary },
  howCard: { backgroundColor: COLORS.white, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#0040300D", flexDirection: "row", gap: 12 },
  howCardBuyer: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, flexDirection: "row", gap: 12, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
  howIconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(74,151,130,0.1)", justifyContent: "center", alignItems: "center" },
  howIconWrapBuyer: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", justifyContent: "center", alignItems: "center" },
  howCardContent: { flex: 1 },
  howCardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  howCardDesc: { fontSize: 13, color: COLORS.textSecondary, opacity: 0.6, lineHeight: 18, fontWeight: "300" },

  // STATS
  statsSection: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 48, overflow: "hidden", position: "relative" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16, maxWidth: 1200, alignSelf: "center" },
  statItem: { width: "47%", alignItems: "center", paddingVertical: 8 },
  statValue: { fontSize: 32, fontWeight: "800", color: COLORS.white, letterSpacing: -0.5 },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2, color: COLORS.secondary, marginTop: 4, textAlign: "center" },

  // FEATURES
  featureRow: { gap: 32 },
  featureText: { flex: 1 },
  featureBadge: { alignSelf: "flex-start", backgroundColor: "rgba(74,151,130,0.1)", paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 16 },
  featureBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: COLORS.secondary },
  featureItem: { flexDirection: "row", gap: 16, marginBottom: 20 },
  featureItemContent: { flex: 1 },
  featureItemTitle: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  featureItemDesc: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, lineHeight: 20, fontWeight: "300" },
  featureVisual: { flex: 1 },

  // WITHDRAW CARD (Worker feature mockup)
  withdrawCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 10, borderWidth: 1, borderColor: "#0040300D", overflow: "hidden", position: "relative" },
  withdrawBgIcon: { position: "absolute", top: 24, right: 24 },
  withdrawHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  withdrawAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },
  withdrawAvatarText: { fontSize: 16, fontWeight: "700", color: COLORS.primary },
  withdrawName: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  withdrawLevel: { fontSize: 11, color: "#00403066" },
  withdrawStatus: { marginLeft: "auto", backgroundColor: "#D1FAE5", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  withdrawStatusText: { fontSize: 11, fontWeight: "700", color: "#065F46" },
  withdrawRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  withdrawTask: { fontSize: 13, color: COLORS.textSecondary, opacity: 0.7, flex: 1, marginRight: 8 },
  withdrawRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  withdrawReward: { fontSize: 13, fontWeight: "700", color: COLORS.primary },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  statusApproved: { backgroundColor: "#D1FAE5" },
  statusPending: { backgroundColor: "#FEF3C7" },
  statusText: { fontSize: 10, fontWeight: "600" },
  statusTextApproved: { color: "#065F46" },
  statusTextPending: { color: "#92400E" },
  withdrawDivider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 12 },
  withdrawEarnings: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  withdrawEarningsLabel: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  withdrawEarningsValue: { fontSize: 22, fontWeight: "700", color: COLORS.secondary },
  withdrawBtn: { backgroundColor: COLORS.secondary, paddingVertical: 14, borderRadius: 10, alignItems: "center", shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  withdrawBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },

  // BUYER SCALE CARD
  buyerScaleCard: { backgroundColor: COLORS.primary, padding: 20, borderRadius: 16, overflow: "hidden" },
  buyerScaleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  buyerScaleLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.5)" },
  buyerScaleLive: { flexDirection: "row", alignItems: "center", gap: 4 },
  buyerScaleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#10B981" },
  buyerScaleLiveText: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.5)" },
  buyerChart: { height: 140, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", padding: 12, flexDirection: "row", alignItems: "flex-end", gap: 6, marginBottom: 12 },
  buyerBar: { flex: 1, backgroundColor: "rgba(74,151,130,0.4)", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  buyerBarActive: { backgroundColor: COLORS.secondary },
  buyerStatsRow: { flexDirection: "row", gap: 12 },
  buyerStatItem: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", padding: 12, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  buyerStatLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.4)", marginBottom: 4 },
  buyerStatValue: { fontSize: 18, fontWeight: "700", color: COLORS.white },

  // COIN ECONOMY
  coinRow: { gap: 32 },
  coinText: { flex: 1 },
  coinBullets: { gap: 12 },
  coinBullet: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  coinBulletText: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.7, lineHeight: 20, flex: 1 },
  packagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pkgCard: { width: "47%", backgroundColor: COLORS.white, paddingVertical: 20, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "#0040301A", alignItems: "center", position: "relative" },
  pkgCardSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  popularBadge: { position: "absolute", top: 6, right: 6, backgroundColor: COLORS.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  popularBadgeText: { fontSize: 8, fontWeight: "700", color: COLORS.white, letterSpacing: 1 },
  pkgLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: "#00403066", marginBottom: 6 },
  pkgLabelSelected: { color: COLORS.secondary },
  pkgCoins: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  pkgCoinsSelected: { color: COLORS.white },
  pkgCoinsLabel: { fontSize: 12, color: "#00403066", marginBottom: 8 },
  pkgCoinsLabelSelected: { color: "rgba(255,255,255,0.6)" },
  pkgPrice: { fontSize: 16, fontWeight: "700", color: COLORS.secondary },

  // ELITE
  eliteHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 },
  eliteSub: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, fontWeight: "300" },
  eliteLink: { fontSize: 14, fontWeight: "700", color: COLORS.secondary },
  eliteScroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  eliteCard: { minWidth: 260, backgroundColor: COLORS.white, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: "#0040300D", marginRight: 16, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 3 },
  eliteCardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16, position: "relative" },
  eliteAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },
  eliteAvatarText: { fontSize: 20, fontWeight: "700", color: COLORS.white, backgroundColor: COLORS.secondary, width: 56, height: 56, borderRadius: 28, textAlign: "center", lineHeight: 56, overflow: "hidden" },
  eliteVerified: { position: "absolute", bottom: -2, left: 38, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center" },
  eliteName: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  eliteStats: { flexDirection: "row", gap: 8 },
  eliteStat: { flex: 1, backgroundColor: COLORS.background, padding: 10, borderRadius: 8 },
  eliteStatLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#00403066", marginBottom: 4 },
  eliteStatRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  eliteStatValue: { fontSize: 14, fontWeight: "700", color: COLORS.primary },

  // TESTIMONIALS
  testimonialRow: { gap: 32 },
  testimonialLeft: { position: "relative", paddingTop: 20 },
  testimonialQuoteMark: { position: "absolute", top: -8, left: -8, fontSize: 80, fontWeight: "900", color: "#0040300D" },
  testimonialTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginBottom: 16 },
  testimonialQuote: { fontSize: 20, lineHeight: 28, color: COLORS.textSecondary, opacity: 0.8, fontWeight: "300", fontStyle: "italic", marginBottom: 20 },
  testimonialAuthor: { flexDirection: "row", alignItems: "center", gap: 12 },
  testimonialAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E2E8F0", justifyContent: "center", alignItems: "center" },
  testimonialAvatarText: { fontSize: 18, fontWeight: "700", color: COLORS.primary },
  testimonialAuthorName: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  testimonialAuthorRole: { fontSize: 10, fontWeight: "700", letterSpacing: 2, color: COLORS.secondary, marginTop: 2 },
  testimonialRight: { gap: 16 },
  testimonialCard: { backgroundColor: COLORS.white, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: "#0040300D", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4 },
  starsRow: { flexDirection: "row", gap: 2, marginBottom: 12 },
  testimonialCardQuote: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, opacity: 0.7, fontWeight: "300", fontStyle: "italic", marginBottom: 12 },
  testimonialCardAuthor: { fontSize: 13, fontWeight: "700", color: COLORS.primary },

  // IMPACT
  impactSection: { backgroundColor: "rgba(220,208,168,0.1)", paddingHorizontal: 16, paddingVertical: 48, alignItems: "center" },
  impactTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, textAlign: "center", marginBottom: 12 },
  impactDesc: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, opacity: 0.7, textAlign: "center", fontWeight: "300", marginBottom: 28, paddingHorizontal: 20 },
  impactGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  impactCard: { width: 280, backgroundColor: "rgba(0,64,48,0.03)", paddingVertical: 28, paddingHorizontal: 32, borderRadius: 16, borderWidth: 1, borderColor: "#0040301A", alignItems: "center" },
  impactIcon: { fontSize: 28, marginBottom: 8 },
  impactValue: { fontSize: 28, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  impactLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 2, color: "#00403066" },

  // FAQ
  faqRow: { gap: 32 },
  faqLeft: { marginBottom: 16 },
  faqBadge: { alignSelf: "flex-start", backgroundColor: "rgba(74,151,130,0.1)", paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  faqBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 2, color: COLORS.secondary },
  faqTitle: { fontSize: 28, fontWeight: "800", color: COLORS.primary, lineHeight: 32, letterSpacing: -0.5, marginBottom: 12 },
  faqDesc: { fontSize: 15, lineHeight: 22, color: COLORS.textSecondary, opacity: 0.6, fontWeight: "300", marginBottom: 20, maxWidth: 300 },
  faqBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignSelf: "flex-start" },
  faqBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  faqRight: { gap: 0 },

  // CTA
  ctaSection: { marginHorizontal: 16, backgroundColor: COLORS.primary, borderRadius: 24, padding: 32, alignItems: "center", position: "relative", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 32, elevation: 16 },
  ctaGlow1: { position: "absolute", top: -40, left: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.secondary, opacity: 0.1 },
  ctaGlow2: { position: "absolute", bottom: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: COLORS.accent, opacity: 0.1 },
  ctaTitle: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: COLORS.white, textAlign: "center", marginBottom: 12, letterSpacing: -0.5 },
  ctaDesc: { fontSize: 15, lineHeight: 22, color: "rgba(255,255,255,0.7)", textAlign: "center", fontWeight: "300", marginBottom: 24, paddingHorizontal: 16 },
  ctaRow: { flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center" },
  ctaSecondary: { backgroundColor: COLORS.secondary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12, shadowColor: COLORS.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  ctaSecondaryText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  ctaGhost: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  ctaGhostText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
});

