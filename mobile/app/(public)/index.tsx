import { useState, useRef } from "react";
import {
  StyleSheet,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { COIN_PACKAGES } from "../../src/lib/constants";
import FadeInView from "../../src/components/animations/FadeInView";
import SlideInView from "../../src/components/animations/SlideInView";
import ScaleOnPress from "../../src/components/animations/ScaleOnPress";
import StaggerContainer from "../../src/components/animations/StaggerContainer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
void SCREEN_WIDTH; // used for layout calculations

type IoniconsName = ComponentProps<typeof Ionicons>["name"];

const HOW_WORKERS: { icon: IoniconsName; title: string; desc: string }[] = [
  {
    icon: "search",
    title: "Browse Curated Tasks",
    desc: "Access a personalized feed of micro-tasks that match your skill profile and availability.",
  },
  {
    icon: "checkmark-circle",
    title: "Execute & Submit",
    desc: "Follow clear guidelines to complete tasks. Our interface makes documentation seamless.",
  },
  {
    icon: "cash",
    title: "Withdraw Earnings",
    desc: "Cash out your coins via Stripe, bKash, or SSLCommerz whenever you want.",
  },
];

const HOW_BUYERS: { icon: IoniconsName; title: string; desc: string }[] = [
  {
    icon: "add-circle",
    title: "Define Your Scope",
    desc: "Post tasks with specific requirements, quality thresholds, and target demographics.",
  },
  {
    icon: "star",
    title: "Review Submissions",
    desc: "Approve or reject worker submissions with one click. Full control over quality.",
  },
  {
    icon: "analytics",
    title: "Scale Operations",
    desc: "Reach thousands of completions per day with our distributed workforce.",
  },
];

const WORKER_FEATURES: { icon: IoniconsName; title: string; desc: string }[] = [
  {
    icon: "shield-checkmark",
    title: "Secure Payments",
    desc: "Our escrow system ensures you get paid for every approved task, with instant withdrawals to multiple providers.",
  },
  {
    icon: "calendar",
    title: "Total Flexibility",
    desc: "Choose tasks that fit your schedule. No minimum hours, no long-term commitments, just pure execution.",
  },
  {
    icon: "trending-up",
    title: "Skill Progression",
    desc: "Higher ratings unlock higher-paying, exclusive tasks. Build your reputation in the marketplace.",
  },
];

const BUYER_FEATURES: { icon: IoniconsName; title: string; desc: string }[] = [
  {
    icon: "speedometer",
    title: "Unmatched Speed",
    desc: "Tasks are picked up in seconds. Reach 10,000 completions per day with our distributed workforce.",
  },
  {
    icon: "checkmark-done",
    title: "Quality Assurance",
    desc: "Built-in consensus algorithms and manual audit tools ensure only the highest quality data enters your system.",
  },
  {
    icon: "code-slash",
    title: "Full API Access",
    desc: "Automate task creation and result ingestion. Integrate TaskHub directly into your existing data pipelines.",
  },
];

const FAQ_ITEMS = [
  {
    q: "How do I withdraw my earnings?",
    a: "You can withdraw your earnings as soon as your balance reaches the minimum threshold of 200 coins. We support bKash and SSLCommerz. Payments are processed within 24 hours.",
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
    a: "Register as a buyer, purchase coins, and post your first task in minutes. Set your payout per worker, deadline, and submission requirements.",
  },
  {
    q: "What happens if a submission is rejected?",
    a: "Rejected submissions do not cost the buyer any coins. Workers receive feedback and can improve their approach on future tasks.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed through trusted gateways. We never store your full card details. Transactions are encrypted end-to-end.",
  },
];

function AccordionItem({
  q,
  a,
  defaultOpen,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  const animHeight = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  const toggle = () => {
    const toVal = open ? 0 : 1;
    Animated.timing(animHeight, {
      toValue: toVal,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setOpen(!open);
  };

  return (
    <View style={faqStyles.item}>
      <TouchableOpacity
        style={faqStyles.toggle}
        onPress={toggle}
        activeOpacity={0.7}
      >
        <View style={faqStyles.questionRow}>
          <View style={[faqStyles.number, open && faqStyles.numberOpen]}>
            <Text
              style={[faqStyles.numberText, open && faqStyles.numberTextOpen]}
            >
              01
            </Text>
          </View>
          <Text style={faqStyles.questionText}>{q}</Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={18}
          color="#00281D"
          style={{
            opacity: 0.3,
            transform: [{ rotate: open ? "180deg" : "0deg" }],
          }}
        />
      </TouchableOpacity>
      {open && (
        <View style={faqStyles.answerContainer}>
          <Text style={faqStyles.answerText}>{a}</Text>
        </View>
      )}
    </View>
  );
}

export default function LandingPage() {
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);

  const handleRegister = (role: string) => {
    router.push(`/(auth)/register?role=${role}`);
  };

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      {/* SECTION 1: HERO */}
      <View style={styles.heroContainer}>
        <View style={styles.heroContent}>
          <FadeInView>
            <Text style={styles.heroTitle}>
              Earn from micro tasks or{" "}
              <Text style={styles.heroHighlight}>get work done faster</Text>
            </Text>
          </FadeInView>
          <SlideInView delay={150} direction="up">
            <Text style={styles.heroSubtitle}>
              The premium marketplace for precise execution. Join thousands of
              workers and buyers in a curated ecosystem built for efficiency.
            </Text>
          </SlideInView>
          <SlideInView delay={300} direction="up">
            <View style={styles.heroButtons}>
              <ScaleOnPress>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleRegister("worker")}
                  activeOpacity={1}
                >
                  <Text style={styles.primaryButtonText}>Start earning</Text>
                  <Ionicons name="arrow-forward" size={16} color="white" />
                </TouchableOpacity>
              </ScaleOnPress>
              <ScaleOnPress>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleRegister("buyer")}
                  activeOpacity={1}
                >
                  <Text style={styles.secondaryButtonText}>Post a task</Text>
                </TouchableOpacity>
              </ScaleOnPress>
            </View>
          </SlideInView>
        </View>

        {/* Mock Dashboard */}
        <View style={styles.mockDashboard}>
          <View style={styles.mockBg} />
          <View style={styles.mockCard}>
            <View style={styles.sidebar}>
              <View style={styles.sidebarLogo}>
                <Text style={styles.sidebarLogoText}>T</Text>
              </View>
              <View style={styles.sidebarIcons}>
                <View style={styles.sidebarIconActive}>
                  <Ionicons name="grid" size={14} color="white" />
                </View>
                <View style={styles.sidebarIconInactive}>
                  <Ionicons
                    name="search"
                    size={14}
                    color="rgba(255,255,255,0.6)"
                  />
                </View>
                <View style={styles.sidebarIconInactive}>
                  <Ionicons
                    name="document"
                    size={14}
                    color="rgba(255,255,255,0.6)"
                  />
                </View>
              </View>
            </View>
            <View style={styles.dashboardContent}>
              <View style={styles.dashboardHeader}>
                <View>
                  <Text style={styles.greetingText}>Good morning,</Text>
                  <Text style={styles.userName}>Alex Johnson</Text>
                </View>
                <View style={styles.coinBadge}>
                  <Ionicons name="ellipse" size={14} color="#F59E0B" />
                  <Text style={styles.coinAmount}>1,240</Text>
                </View>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Tasks Done</Text>
                  <Text style={styles.statValue}>38</Text>
                  <Text style={styles.statTrend}>↑ 4 this week</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Earned</Text>
                  <Text style={styles.earnedValue}>
                    620 <Text style={styles.earnedLabel}>coins</Text>
                  </Text>
                  <Text style={styles.earnedSubtext}>≈ $31.00</Text>
                </View>
              </View>
              <View style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle}>
                    Write a 5-star product review
                  </Text>
                  <View style={styles.taskRewardBadge}>
                    <Text style={styles.taskRewardText}>+20 coins</Text>
                  </View>
                </View>
                <Text style={styles.taskDesc}>
                  Take a screenshot of your review and submit proof.
                </Text>
                <View style={styles.taskFooter}>
                  <Text style={styles.taskSlots}>2 of 50 slots left</Text>
                  <TouchableOpacity style={styles.startTaskBtn}>
                    <Text style={styles.startTaskBtnText}>Start Task</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 2: TRUSTED BY */}
      <View style={styles.trustedBy}>
        <Text style={styles.trustedLabel}>TRUSTED BY:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          contentContainerStyle={styles.trustedLogos}
        >
          {[
            "TechCorp",
            "DataFlow",
            "AILabs",
            "CloudSync",
            "NexGen",
            "PixelWorks",
            "TechCorp",
            "DataFlow",
            "AILabs",
            "CloudSync",
          ].map((b, i) => (
            <View key={`${b}-${i}`} style={styles.trustedBadge}>
              <Text style={styles.trustedName}>{b}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* SECTION 3: HOW IT WORKS */}
      <View style={styles.howSection}>
        <View style={styles.howHeader}>
          <Text style={styles.howTitle}>
            Precision Engineering for Every Workflow
          </Text>
          <Text style={styles.howSubtitle}>
            {
              "Whether you're looking to complete micro-tasks or scale your operations, TaskHub provides the infrastructure."
            }
          </Text>
        </View>
        <View style={styles.howColumns}>
          <View style={styles.howColumn}>
            <View style={styles.howColumnHeader}>
              <View style={styles.howLineSecondary} />
              <Text style={styles.howColumnLabel}>FOR WORKERS</Text>
            </View>
            {HOW_WORKERS.map((item) => (
              <View key={item.title} style={styles.howCardWhite}>
                <View style={styles.howIconContainer}>
                  <Ionicons name={item.icon} size={20} color="#4A9782" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.howCardTitle}>{item.title}</Text>
                  <Text style={styles.howCardDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.howColumn}>
            <View style={styles.howColumnHeader}>
              <View style={styles.howLinePrimary} />
              <Text style={styles.howColumnLabel}>FOR BUYERS</Text>
            </View>
            {HOW_BUYERS.map((item) => (
              <View key={item.title} style={styles.howCardDark}>
                <View style={styles.howIconContainerDark}>
                  <Ionicons name={item.icon} size={20} color="#4A9782" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.howCardTitleLight}>{item.title}</Text>
                  <Text style={styles.howCardDescLight}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 4: STATS */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          {[
            { value: "450K+", label: "WORKERS REGISTERED" },
            { value: "1.2M+", label: "TASKS COMPLETED" },
            { value: "$15M+", label: "USD PAID OUT" },
            { value: "99.8%", label: "SUCCESS RATE" },
          ].map((item) => (
            <View key={item.label} style={styles.statItem}>
              <Text style={styles.statNumber}>{item.value}</Text>
              <Text style={styles.statLabelSecondary}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SECTION 5: WORKER FEATURES */}
      <View style={styles.workerFeatures}>
        <View style={styles.workerFeaturesInner}>
          <View style={styles.workerFeaturesLeft}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>EMPOWERING TALENT</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Work on your terms, get paid for your precision
            </Text>
            {WORKER_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Ionicons
                  name={f.icon}
                  size={20}
                  color="#4A9782"
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <View style={styles.workerFeaturesRight}>
            <View style={styles.testimonialCard}>
              <View style={styles.testimonialBgIcon}>
                <Ionicons
                  name="cash"
                  size={60}
                  color="#DCD0A8"
                  style={{ opacity: 0.1 }}
                />
              </View>
              <View style={styles.testimonialHeader}>
                <View style={styles.testimonialAvatar}>
                  <Text style={styles.testimonialAvatarText}>M</Text>
                </View>
                <View>
                  <Text style={styles.testimonialName}>Maria S.</Text>
                  <Text style={styles.testimonialRole}>
                    Top Contributor · Level 4
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Active</Text>
                </View>
              </View>
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
                <View key={t.task} style={styles.taskRow}>
                  <Text style={styles.taskRowName} numberOfLines={1}>
                    {t.task}
                  </Text>
                  <View style={styles.taskRowMeta}>
                    <Text style={styles.taskRowReward}>{t.reward}</Text>
                    <View
                      style={[
                        styles.taskRowStatus,
                        t.status === "Approved"
                          ? styles.statusApproved
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.taskRowStatusText,
                          t.status === "Approved"
                            ? styles.statusApprovedText
                            : styles.statusPendingText,
                        ]}
                      >
                        {t.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.earningsHeader}>
                <Text style={styles.earningsLabel}>Earnings this week</Text>
                <Text style={styles.earningsAmount}>$342.50</Text>
              </View>
              <TouchableOpacity
                style={styles.withdrawBtn}
                onPress={() => handleRegister("worker")}
                activeOpacity={0.9}
              >
                <Text style={styles.withdrawBtnText}>Withdraw Funds</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 6: BUYER FEATURES */}
      <View style={styles.buyerFeatures}>
        <View style={styles.buyerFeaturesInner}>
          <View style={styles.buyerFeaturesRight}>
            <View style={styles.opsCard}>
              <View style={styles.opsHeader}>
                <Text style={styles.opsLabel}>REAL-TIME OPERATIONS</Text>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>Live</Text>
                </View>
              </View>
              <View style={styles.chartContainer}>
                {[20, 40, 80, 60, 90, 50].map((h, i) => (
                  <View
                    key={i}
                    style={[
                      styles.chartBar,
                      (i === 2 || i === 4) && styles.chartBarActive,
                      { height: `${h}%` },
                    ]}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>ACTIVE WORKERS</Text>
                  <Text style={styles.metricValue}>8,294</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>COST PER TASK</Text>
                  <Text style={styles.metricValue}>$0.02</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.buyerFeaturesLeft}>
            <View style={styles.sectionBadgeAlt}>
              <Text style={styles.sectionBadgeAltText}>FOR BUSINESS SCALE</Text>
            </View>
            <Text style={styles.sectionTitle}>
              Deploy micro-tasks at global scale with zero friction
            </Text>
            {BUYER_FEATURES.map((f) => (
              <View key={f.title} style={styles.featureRow}>
                <Ionicons
                  name={f.icon}
                  size={20}
                  color="#004030"
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 7: COIN ECONOMY */}
      <View style={styles.coinSection}>
        <View style={styles.coinSectionInner}>
          <View style={styles.coinInfo}>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>COIN ECONOMY</Text>
            </View>
            <Text style={styles.sectionTitle}>Simple, transparent pricing</Text>
            <View style={{ gap: 12 }}>
              <View style={styles.coinRow}>
                <Ionicons name="diamond" size={18} color="#4A9782" />
                <Text style={styles.coinRowText}>
                  <Text style={styles.coinRowBold}>Buyers</Text> purchase 10
                  coins for $1 USD.
                </Text>
              </View>
              <View style={styles.coinRow}>
                <Ionicons name="cash" size={18} color="#4A9782" />
                <Text style={styles.coinRowText}>
                  <Text style={styles.coinRowBold}>Workers</Text> withdraw $1
                  USD per 20 coins earned.
                </Text>
              </View>
              <View style={styles.coinRow}>
                <Ionicons name="information-circle" size={18} color="#4A9782" />
                <Text style={styles.coinRowText}>
                  The spread between buy and withdraw rates sustains the
                  platform.
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.packages}>
            {COIN_PACKAGES.map((pkg) => (
              <TouchableOpacity
                key={pkg.id}
                style={[
                  styles.pkgCard,
                  selectedPkg === pkg.id && styles.pkgCardSelected,
                ]}
                onPress={() =>
                  setSelectedPkg(pkg.id === selectedPkg ? null : pkg.id)
                }
                activeOpacity={0.8}
              >
                {pkg.popular && (
                  <View style={styles.pkgBadge}>
                    <Text style={styles.pkgBadgeText}>POPULAR</Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.pkgLabel,
                    selectedPkg === pkg.id && styles.pkgLabelSelected,
                  ]}
                >
                  {pkg.label}
                </Text>
                <Text
                  style={[
                    styles.pkgCoins,
                    selectedPkg === pkg.id && styles.pkgCoinsSelected,
                  ]}
                >
                  {pkg.coins.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.pkgCoinsLabel,
                    selectedPkg === pkg.id && styles.pkgCoinsLabelSelected,
                  ]}
                >
                  coins
                </Text>
                <Text style={styles.pkgPrice}>${pkg.price.toFixed(2)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 8: ELITE CONTRIBUTORS */}
      <View style={styles.contributors}>
        <View style={styles.contributorsHeader}>
          <View>
            <Text style={styles.contributorsTitle}>Elite Contributors</Text>
            <Text style={styles.contributorsSubtitle}>
              Recognizing our highest-performing task masters this month.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(public)/leaderboard")}
            style={styles.leaderboardLink}
          >
            <Text style={styles.leaderboardLinkText}>View leaderboard</Text>
            <Ionicons name="arrow-forward" size={14} color="#4A9782" />
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.contributorsScrollView}
        >
          {[
            { name: "Alex Rodriguez", coins: 12450, approval: "99.2%" },
            { name: "Sarah Chen", coins: 10820, approval: "98.7%" },
            { name: "Priya Sharma", coins: 9450, approval: "100%" },
            { name: "James Wilson", coins: 8900, approval: "97.5%" },
            { name: "Aisha Patel", coins: 7600, approval: "99.1%" },
            { name: "Lucas Kim", coins: 7200, approval: "96.8%" },
          ].map((w) => (
            <View key={w.name} style={styles.contributorCard}>
              <View style={styles.contributorAvatarRow}>
                <View style={styles.contributorAvatar}>
                  <Text style={styles.contributorAvatarInitial}>
                    {w.name[0]}
                  </Text>
                </View>
                <View style={styles.contributorVerified}>
                  <Ionicons name="checkmark-circle" size={16} color="#4A9782" />
                </View>
              </View>
              <Text style={styles.contributorName}>{w.name}</Text>
              <View style={styles.contributorStats}>
                <View style={styles.contributorStatBox}>
                  <Text style={styles.contributorStatLabel}>COINS EARNED</Text>
                  <View style={styles.contributorStatValue}>
                    <Ionicons name="diamond" size={12} color="#F59E0B" />
                    <Text style={styles.contributorStatNumber}>
                      {w.coins.toLocaleString()}
                    </Text>
                  </View>
                </View>
                <View style={styles.contributorStatBox}>
                  <Text style={styles.contributorStatLabel}>APPROVED</Text>
                  <Text style={styles.contributorStatNumberAlt}>
                    {w.approval}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* SECTION 9: COMMUNITY VOICE */}
      <View style={styles.communitySection}>
        <View style={styles.communityInner}>
          <View style={styles.testimonialFeatured}>
            <Text style={styles.quoteMark}>&quot;</Text>
            <Text style={styles.communityTitle}>Community Voice</Text>
            <Text style={styles.featuredQuote}>
              {
                '"TaskHub transformed our data annotation process. We scaled from 100 to 10,000 labels a day without sacrificing quality."'
              }
            </Text>
            <View style={styles.quoteAuthor}>
              <View style={styles.quoteAuthorAvatar}>
                <Text style={styles.quoteAuthorInitial}>M</Text>
              </View>
              <View>
                <Text style={styles.quoteAuthorName}>Marcus Thorne</Text>
                <Text style={styles.quoteAuthorRole}>
                  HEAD OF AI AT DATASTREAM
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.testimonialCards}>
            <View style={styles.testimonialCardSm}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons key={i} name="star" size={16} color="#FBBF24" />
                ))}
              </View>
              <Text style={styles.testimonialQuote}>
                &quot;Consistent payouts and a clean interface. Best micro-task
                platform I&apos;ve used.&quot;
              </Text>
              <Text style={styles.testimonialAuthor}>
                Elena Petrova ·{" "}
                <Text style={styles.testimonialAuthorSub}>
                  Verified Task Master
                </Text>
              </Text>
            </View>
            <View style={styles.testimonialCardSm}>
              <Ionicons name="flash" size={20} color="#4A9782" />
              <Text style={[styles.testimonialQuote, { marginTop: 8 }]}>
                &quot;Lightning fast turnaround on our marketing outreach tasks. What
                used to take a week now takes four hours.&quot;
              </Text>
              <Text style={styles.testimonialAuthor}>
                David Chen ·{" "}
                <Text style={styles.testimonialAuthorSub}>Startup Founder</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* SECTION 10: GLOBAL IMPACT */}
      <View style={styles.impactSection}>
        <Text style={styles.impactTitle}>Global Impact, Local Empowerment</Text>
        <Text style={styles.impactSubtitle}>
          TaskHub isn&apos;t just a platform; it&apos;s a movement providing fair-wage
          opportunities to individuals in 140+ countries.
        </Text>
        <View style={styles.impactGrid}>
          {[
            { value: "140+", label: "COUNTRIES", icon: "🌍" },
            { value: "12ms", label: "TASK LATENCY", icon: "⚡" },
            { value: "0%", label: "PAYMENT FEES", icon: "💸" },
          ].map((item) => (
            <View key={item.label} style={styles.impactCard}>
              <Text style={styles.impactIcon}>{item.icon}</Text>
              <Text style={styles.impactValue}>{item.value}</Text>
              <Text style={styles.impactLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* SECTION 11: FAQ */}
      <View style={styles.faqSection}>
        <View style={styles.faqInner}>
          <View style={styles.faqHeader}>
            <View style={styles.faqBadge}>
              <Text style={styles.faqBadgeText}>GOT QUESTIONS?</Text>
            </View>
            <Text style={styles.faqTitle}>Everything you need to know.</Text>
            <Text style={styles.faqSubtitle}>
              Can&apos;t find the answer you&apos;re looking for? Reach out to our support
              team.
            </Text>
            <TouchableOpacity
              style={styles.supportBtn}
              onPress={() => router.push("/(public)/support")}
            >
              <Ionicons name="help-buoy" size={16} color="white" />
              <Text style={styles.supportBtnText}>Visit Support Hub</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.accordionList}>
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem
                key={item.q}
                q={item.q}
                a={item.a}
                defaultOpen={i === 0}
              />
            ))}
          </View>
        </View>
      </View>

      {/* SECTION 12: FINAL CTA */}
      <SlideInView direction="up">
        <View style={styles.ctaSection}>
          <View style={styles.ctaCircleTopLeft} />
          <View style={styles.ctaCircleBottomRight} />
          <FadeInView>
            <Text style={styles.ctaTitle}>Ready to redefine how you work?</Text>
          </FadeInView>
          <SlideInView delay={150} direction="up">
            <Text style={styles.ctaSubtitle}>
              Join the most efficient micro-tasking network today. Signing up takes
              less than 2 minutes.
            </Text>
          </SlideInView>
          <SlideInView delay={300} direction="up">
            <View style={styles.ctaButtons}>
              <ScaleOnPress>
                <TouchableOpacity
                  style={styles.ctaPrimaryBtn}
                  onPress={() => handleRegister("worker")}
                  activeOpacity={1}
                >
                  <Text style={styles.ctaPrimaryBtnText}>Get Started Now</Text>
                </TouchableOpacity>
              </ScaleOnPress>
              <ScaleOnPress>
                <TouchableOpacity
                  style={styles.ctaSecondaryBtn}
                  onPress={() => router.push("/(public)/browse-tasks")}
                  activeOpacity={1}
                >
                  <Text style={styles.ctaSecondaryBtnText}>Learn More</Text>
                </TouchableOpacity>
              </ScaleOnPress>
            </View>
          </SlideInView>
        </View>
      </SlideInView>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: "#FFF9E5",
  },
  heroContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 8,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  heroContent: {
    marginBottom: 36,
  },
  heroTitle: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: "700",
    color: "#004030",
    letterSpacing: -0.5,
  },
  heroHighlight: {
    color: "#4A9782",
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 26,
    color: "rgba(0,64,48,0.7)",
    marginTop: 16,
    fontWeight: "300",
  },
  heroButtons: {
    flexDirection: "column",
    gap: 12,
    marginTop: 20,
  },
  primaryButton: {
    backgroundColor: "#004030",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: "#4A9782",
    backgroundColor: "#FFF9E5",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#004030",
    fontSize: 16,
    fontWeight: "700",
  },
  mockDashboard: {
    position: "relative",
    marginTop: 8,
  },
  mockBg: {
    position: "absolute",
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    backgroundColor: "rgba(74,151,130,0.1)",
    borderRadius: 24,
  },
  mockCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
  },
  sidebar: {
    width: 48,
    backgroundColor: "#004030",
    paddingVertical: 16,
    alignItems: "center",
  },
  sidebarLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  sidebarLogoText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  sidebarIcons: {
    gap: 12,
    alignItems: "center",
  },
  sidebarIconActive: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sidebarIconInactive: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  dashboardContent: {
    flex: 1,
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  dashboardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  greetingText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#004030",
  },
  coinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  coinAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D97706",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  statLabel: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#004030",
  },
  statTrend: {
    fontSize: 11,
    color: "#10B981",
    marginTop: 2,
  },
  earnedValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4A9782",
  },
  earnedLabel: {
    fontSize: 11,
    fontWeight: "400",
    color: "#94A3B8",
  },
  earnedSubtext: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 2,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#4A9782",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  taskTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#004030",
    flex: 1,
  },
  taskRewardBadge: {
    backgroundColor: "rgba(74,151,130,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  taskRewardText: {
    fontSize: 10,
    color: "#4A9782",
    fontWeight: "600",
  },
  taskDesc: {
    fontSize: 11,
    color: "#94A3B8",
    marginBottom: 8,
  },
  taskFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  taskSlots: {
    fontSize: 11,
    color: "#94A3B8",
  },
  startTaskBtn: {
    backgroundColor: "#4A9782",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  startTaskBtnText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  trustedBy: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    overflow: "hidden",
  },
  trustedLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "rgba(0,64,48,0.4)",
    marginBottom: 12,
  },
  trustedLogos: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    paddingVertical: 4,
  },
  trustedBadge: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
  },
  trustedName: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(0,64,48,0.5)",
  },
  howSection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  howHeader: {
    alignItems: "center",
    marginBottom: 32,
  },
  howTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  howSubtitle: {
    fontSize: 15,
    color: "rgba(0,64,48,0.6)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 500,
  },
  howColumns: {
    gap: 24,
  },
  howColumn: {
    gap: 12,
  },
  howColumnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  howLineSecondary: {
    width: 40,
    height: 2,
    backgroundColor: "#4A9782",
  },
  howLinePrimary: {
    width: 40,
    height: 2,
    backgroundColor: "#004030",
  },
  howColumnLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#004030",
  },
  howCardWhite: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    flexDirection: "row",
    gap: 12,
  },
  howIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(74,151,130,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  howCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 4,
  },
  howCardDesc: {
    fontSize: 13,
    color: "rgba(0,64,48,0.6)",
    lineHeight: 18,
    fontWeight: "300",
  },
  howCardDark: {
    backgroundColor: "#004030",
    padding: 16,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  howIconContainerDark: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  howCardTitleLight: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  howCardDescLight: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    lineHeight: 18,
    fontWeight: "300",
  },
  statsSection: {
    backgroundColor: "#004030",
    paddingHorizontal: 16,
    paddingVertical: 48,
    overflow: "hidden",
    position: "relative",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    maxWidth: 1200,
    alignSelf: "center",
  },
  statItem: {
    width: "47%",
    alignItems: "center",
    paddingVertical: 8,
  },
  statNumber: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  statLabelSecondary: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#4A9782",
    marginTop: 4,
    textAlign: "center",
  },
  workerFeatures: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  workerFeaturesInner: {
    gap: 32,
  },
  workerFeaturesLeft: {
    flex: 1,
  },
  sectionBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,151,130,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 16,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#4A9782",
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  featureRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 20,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 16,
    color: "rgba(0,64,48,0.6)",
    lineHeight: 20,
    fontWeight: "300",
  },
  workerFeaturesRight: {
    flex: 1,
  },
  testimonialCard: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    overflow: "hidden",
    position: "relative",
  },
  testimonialBgIcon: {
    position: "absolute",
    top: 24,
    right: 24,
  },
  testimonialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  testimonialAvatar: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  testimonialAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004030",
  },
  testimonialName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#004030",
  },
  testimonialRole: {
    fontSize: 11,
    color: "rgba(0,64,48,0.4)",
  },
  statusBadge: {
    marginLeft: "auto",
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#065F46",
  },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  taskRowName: {
    fontSize: 13,
    color: "rgba(0,64,48,0.7)",
    flex: 1,
    marginRight: 8,
  },
  taskRowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  taskRowReward: {
    fontSize: 13,
    fontWeight: "700",
    color: "#004030",
  },
  taskRowStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  statusApproved: {
    backgroundColor: "#D1FAE5",
  },
  statusPending: {
    backgroundColor: "#FEF3C7",
  },
  taskRowStatusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusApprovedText: {
    color: "#065F46",
  },
  statusPendingText: {
    color: "#92400E",
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 12,
  },
  earningsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  earningsLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004030",
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#4A9782",
  },
  withdrawBtn: {
    backgroundColor: "#4A9782",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  withdrawBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  buyerFeatures: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
  },
  buyerFeaturesInner: {
    gap: 32,
    flexDirection: "column-reverse",
  },
  buyerFeaturesRight: {
    flex: 1,
    marginTop: 24,
  },
  opsCard: {
    backgroundColor: "#004030",
    padding: 20,
    borderRadius: 16,
    overflow: "hidden",
  },
  opsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  opsLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "rgba(255,255,255,0.5)",
  },
  liveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: "#10B981",
  },
  liveText: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
  },
  chartContainer: {
    height: 140,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginBottom: 12,
  },
  chartBar: {
    flex: 1,
    backgroundColor: "rgba(74,151,130,0.4)",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  chartBarActive: {
    backgroundColor: "#4A9782",
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.4)",
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  buyerFeaturesLeft: {
    flex: 1,
  },
  sectionBadgeAlt: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,64,48,0.05)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 16,
  },
  sectionBadgeAltText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#004030",
  },
  coinSection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  coinSectionInner: {
    gap: 32,
  },
  coinInfo: {
    flex: 1,
  },
  coinRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  coinRowText: {
    fontSize: 16,
    color: "rgba(0,64,48,0.7)",
    lineHeight: 20,
    flex: 1,
  },
  coinRowBold: {
    fontWeight: "700",
  },
  packages: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  pkgCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.1)",
    alignItems: "center",
    position: "relative",
  },
  pkgCardSelected: {
    backgroundColor: "#004030",
    borderColor: "#004030",
  },
  pkgBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "#4A9782",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pkgBadgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.8,
  },
  pkgLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 6,
    color: "rgba(0,64,48,0.4)",
  },
  pkgLabelSelected: {
    color: "#4A9782",
  },
  pkgCoins: {
    fontSize: 28,
    fontWeight: "800",
    color: "#004030",
  },
  pkgCoinsSelected: {
    color: "#FFFFFF",
  },
  pkgCoinsLabel: {
    fontSize: 12,
    marginBottom: 8,
    color: "rgba(0,64,48,0.4)",
  },
  pkgCoinsLabelSelected: {
    color: "rgba(255,255,255,0.6)",
  },
  pkgPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4A9782",
  },
  contributors: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
    borderTopWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
  },
  contributorsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 20,
  },
  contributorsTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  contributorsSubtitle: {
    fontSize: 16,
    color: "rgba(0,64,48,0.6)",
    fontWeight: "300",
  },
  leaderboardLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leaderboardLinkText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4A9782",
  },
  contributorsScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  contributorCard: {
    minWidth: 260,
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    marginRight: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  contributorAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    position: "relative",
  },
  contributorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  contributorAvatarInitial: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    backgroundColor: "#4A9782",
    width: 56,
    height: 56,
    borderRadius: 9999,
    textAlign: "center",
    lineHeight: 56,
    overflow: "hidden",
  },
  contributorVerified: {
    position: "absolute",
    bottom: -2,
    left: 38,
    width: 20,
    height: 20,
    borderRadius: 9999,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  contributorName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 12,
  },
  contributorStats: {
    flexDirection: "row",
    gap: 8,
  },
  contributorStatBox: {
    flex: 1,
    backgroundColor: "#FFF9E5",
    padding: 10,
    borderRadius: 8,
  },
  contributorStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(0,64,48,0.4)",
    marginBottom: 4,
  },
  contributorStatValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  contributorStatNumber: {
    fontSize: 14,
    fontWeight: "700",
    color: "#004030",
  },
  contributorStatNumberAlt: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4A9782",
  },
  communitySection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  communityInner: {
    gap: 32,
  },
  testimonialFeatured: {
    position: "relative",
    paddingTop: 20,
  },
  quoteMark: {
    position: "absolute",
    top: -8,
    left: -8,
    fontSize: 80,
    fontWeight: "900",
    color: "rgba(0,64,48,0.05)",
  },
  communityTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 16,
  },
  featuredQuote: {
    fontSize: 20,
    lineHeight: 28,
    color: "rgba(0,64,48,0.8)",
    fontWeight: "300",
    fontStyle: "italic",
    marginBottom: 20,
  },
  quoteAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quoteAuthorAvatar: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  quoteAuthorInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#004030",
  },
  quoteAuthorName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#004030",
  },
  quoteAuthorRole: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#4A9782",
    marginTop: 2,
  },
  testimonialCards: {
    gap: 16,
  },
  testimonialCardSm: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  stars: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 12,
  },
  testimonialQuote: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(0,64,48,0.7)",
    fontWeight: "300",
    fontStyle: "italic",
    marginBottom: 12,
  },
  testimonialAuthor: {
    fontSize: 13,
    fontWeight: "700",
    color: "#004030",
  },
  testimonialAuthorSub: {
    color: "rgba(0,64,48,0.4)",
  },
  impactSection: {
    backgroundColor: "rgba(220,208,168,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 48,
    alignItems: "center",
  },
  impactTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#004030",
    textAlign: "center",
    marginBottom: 12,
  },
  impactSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(0,64,48,0.7)",
    textAlign: "center",
    fontWeight: "300",
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  impactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  impactCard: {
    width: 280,
    backgroundColor: "rgba(0,64,48,0.03)",
    paddingVertical: 28,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.1)",
    alignItems: "center",
  },
  impactIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  impactValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "rgba(0,64,48,0.4)",
  },
  faqSection: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    maxWidth: 1200,
    width: "100%",
    alignSelf: "center",
  },
  faqInner: {
    gap: 32,
  },
  faqHeader: {
    marginBottom: 16,
  },
  faqBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,151,130,0.1)",
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 12,
  },
  faqBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    color: "#4A9782",
  },
  faqTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#004030",
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  faqSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(0,64,48,0.6)",
    fontWeight: "300",
    marginBottom: 20,
    maxWidth: 300,
  },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#004030",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  supportBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  accordionList: {
    gap: 0,
  },
  ctaSection: {
    marginHorizontal: 16,
    backgroundColor: "#004030",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  ctaCircleTopLeft: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 9999,
    backgroundColor: "rgba(74,151,130,0.1)",
  },
  ctaCircleBottomRight: {
    position: "absolute",
    bottom: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 9999,
    backgroundColor: "rgba(220,208,168,0.1)",
  },
  ctaTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  ctaSubtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontWeight: "300",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  ctaButtons: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  ctaPrimaryBtn: {
    backgroundColor: "#4A9782",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  ctaSecondaryBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaSecondaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

const faqStyles = StyleSheet.create({
  item: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(0,64,48,0.05)",
    borderRadius: 16,
    marginBottom: 8,
    overflow: "hidden",
  },
  toggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  number: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(74,151,130,0.1)",
  },
  numberOpen: {
    backgroundColor: "#004030",
  },
  numberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4A9782",
  },
  numberTextOpen: {
    color: "#FFFFFF",
  },
  questionText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#00281D",
    flex: 1,
  },
  answerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingLeft: 60,
  },
  answerText: {
    fontSize: 16,
    color: "rgba(0,64,48,0.6)",
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,64,48,0.05)",
    paddingTop: 12,
  },
});
