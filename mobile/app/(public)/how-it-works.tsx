import { useState, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Animated, StyleSheet,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const COIN_FACTS = [
  { label: "10 coins = $1", sub: "Buyer purchase rate" },
  { label: "20 coins = $1", sub: "Worker withdrawal rate" },
  { label: "200 coins min", sub: "Minimum withdrawal" },
  { label: "24h payout", sub: "Average processing time" },
];

const BUYER_STEPS = [
  {
    step: "01", title: "Buy Coins", icon: "diamond",
    desc: "Purchase coins starting at $1 for 10 coins. Choose a package that fits your budget.",
  },
  {
    step: "02", title: "Post a Task", icon: "add-circle",
    desc: "Write clear instructions, set the coin payout per worker, choose how many workers you need, and set a deadline.",
  },
  {
    step: "03", title: "Workers Submit", icon: "people",
    desc: "Workers from around the world find your task, complete it, and submit proof.",
  },
  {
    step: "04", title: "Approve & Pay", icon: "checkmark-circle",
    desc: "Review each submission. Approve the ones that meet your standard — coins transfer only on approval.",
  },
];

const WORKER_STEPS = [
  {
    step: "01", title: "Create an Account", icon: "person-add",
    desc: "Sign up free as a Worker. You get 10 starter coins just for joining.",
  },
  {
    step: "02", title: "Browse Tasks", icon: "search",
    desc: "Filter tasks by category, payout, or deadline. Read the instructions carefully before you start.",
  },
  {
    step: "03", title: "Submit Your Work", icon: "cloud-upload",
    desc: "Complete the task and submit your proof — a screenshot, link, or written response.",
  },
  {
    step: "04", title: "Earn & Withdraw", icon: "cash",
    desc: "Coins land in your account the moment a buyer approves. Hit 200 coins and request a cash withdrawal.",
  },
];

const PAYMENT_METHODS = [
  { name: "Stripe", note: "Global — cards & wallets", icon: "card" },
  { name: "bKash", note: "Bangladesh mobile banking", icon: "phone-portrait" },
  { name: "SSLCommerz", note: "Bangladesh gateway", icon: "business" },
];

export default function HowItWorks() {
  return (
    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroBadge}>HOW IT WORKS</Text>
        <Text style={styles.heroTitle}>
          Simple by design.{"\n"}
          <Text style={styles.heroHighlight}>Powerful in practice.</Text>
        </Text>
        <Text style={styles.heroSub}>
          TaskHub runs on a coin economy that keeps things transparent for everyone.
        </Text>
        <View style={styles.heroBtns}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(auth)/register")} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Get Started Free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/(public)/browse-tasks")} activeOpacity={0.9}>
            <Text style={styles.secondaryBtnText}>Browse Tasks</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Coin Facts */}
      <View style={styles.factsRow}>
        {COIN_FACTS.map((f) => (
          <View key={f.label} style={styles.factCard}>
            <Text style={styles.factLabel}>{f.label}</Text>
            <Text style={styles.factSub}>{f.sub}</Text>
          </View>
        ))}
      </View>

      {/* For Buyers */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLineSecondary} />
          <View>
            <Text style={styles.sectionBadge}>FOR BUYERS</Text>
            <Text style={styles.sectionTitle}>Get tasks done in 4 steps</Text>
          </View>
        </View>
        <View style={styles.stepsGrid}>
          {BUYER_STEPS.map((s) => (
            <View key={s.step} style={styles.stepCard}>
              <View style={styles.stepIconRow}>
                <View style={styles.stepIcon}>
                  <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color="#4A9782" />
                </View>
                <Text style={styles.stepNumber}>{s.step}</Text>
              </View>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {/* For Workers */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionLineSecondary} />
          <View>
            <Text style={styles.sectionBadge}>FOR WORKERS</Text>
            <Text style={styles.sectionTitle}>Start earning in 4 steps</Text>
          </View>
        </View>
        <View style={styles.stepsGrid}>
          {WORKER_STEPS.map((s) => (
            <View key={s.step} style={[styles.stepCard, styles.stepCardDark]}>
              <View style={styles.stepIconRow}>
                <View style={styles.stepIconDark}>
                  <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={20} color="#4A9782" />
                </View>
                <Text style={[styles.stepNumber, { color: "rgba(255,255,255,0.15)" }]}>{s.step}</Text>
              </View>
              <Text style={[styles.stepTitle, { color: "#FFF" }]}>{s.title}</Text>
              <Text style={[styles.stepDesc, { color: "rgba(255,255,255,0.6)" }]}>{s.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Coin Economy */}
      <View style={styles.coinSection}>
        <Text style={styles.coinBadge}>THE COIN ECONOMY</Text>
        <Text style={styles.coinTitle}>Transparent pricing, no surprises</Text>
        <Text style={styles.coinSub}>The spread between buy and sell rates is how TaskHub earns.</Text>
        <View style={styles.coinCards}>
          <View style={styles.coinCard}>
            <Ionicons name="cart" size={24} color="#4A9782" />
            <Text style={styles.coinCardTitle}>$1 = 10 coins</Text>
            <Text style={styles.coinCardSub}>Buyer purchase rate</Text>
          </View>
          <View style={[styles.coinCard, styles.coinCardAccent]}>
            <Ionicons name="swap-horizontal" size={24} color="#4A9782" />
            <Text style={styles.coinCardTitle}>Platform fee</Text>
            <Text style={styles.coinCardSub}>Built into the spread</Text>
          </View>
          <View style={styles.coinCard}>
            <Ionicons name="wallet" size={24} color="#4A9782" />
            <Text style={styles.coinCardTitle}>20 coins = $1</Text>
            <Text style={styles.coinCardSub}>Worker withdrawal rate</Text>
          </View>
        </View>
        <View style={styles.coinExample}>
          <Text style={styles.coinExampleText}>
            Example: A buyer funds a task with 100 coins ($10). A worker completes it and earns 100 coins — worth $5 on withdrawal. TaskHub keeps the $5 difference as its fee.
          </Text>
        </View>
      </View>

      {/* Payment Methods */}
      <View style={styles.section}>
        <Text style={styles.paymentBadge}>PAYMENT METHODS</Text>
        <Text style={styles.paymentTitle}>Pay and get paid your way</Text>
        <View style={styles.paymentGrid}>
          {PAYMENT_METHODS.map((m) => (
            <View key={m.name} style={styles.paymentCard}>
              <Ionicons name={m.icon as keyof typeof Ionicons.glyphMap} size={24} color="#4A9782" />
              <Text style={styles.paymentName}>{m.name}</Text>
              <Text style={styles.paymentNote}>{m.note}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        <View style={styles.ctaCard}>
          <Ionicons name="construct" size={28} color="#4A9782" />
          <Text style={styles.ctaTitle}>Ready to earn?</Text>
          <Text style={styles.ctaDesc}>Browse hundreds of tasks, complete them on your schedule, and withdraw real cash.</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push("/(auth)/register")}>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
            <Text style={styles.ctaBtnText}>Join as Worker</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.ctaCard, styles.ctaCardDark]}>
          <Ionicons name="briefcase" size={28} color="#4A9782" />
          <Text style={[styles.ctaTitle, { color: "#FFF" }]}>Need tasks done?</Text>
          <Text style={[styles.ctaDesc, { color: "rgba(255,255,255,0.6)" }]}>Post a task in minutes, set your budget, and get results from real workers.</Text>
          <TouchableOpacity style={[styles.ctaBtn, styles.ctaBtnLight]} onPress={() => router.push("/(auth)/register")}>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
            <Text style={styles.ctaBtnText}>Post a Task</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#FFF9E5" },
  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20, alignItems: "center" },
  heroBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#4A9782", marginBottom: 12 },
  heroTitle: { fontSize: 28, fontWeight: "800", color: "#004030", textAlign: "center", lineHeight: 34 },
  heroHighlight: { color: "#4A9782" },
  heroSub: { fontSize: 14, color: "rgba(0,64,48,0.6)", textAlign: "center", marginTop: 12, lineHeight: 20, maxWidth: 320 },
  heroBtns: { flexDirection: "column", gap: 10, marginTop: 20, width: "100%", maxWidth: 280 },
  primaryBtn: { backgroundColor: "#004030", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  primaryBtnText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  secondaryBtn: { borderWidth: 2, borderColor: "#4A9782", paddingVertical: 14, borderRadius: 8, alignItems: "center" },
  secondaryBtnText: { color: "#004030", fontSize: 15, fontWeight: "700" },
  factsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  factCard: { backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,64,48,0.05)", padding: 12, width: "47%" },
  factLabel: { fontSize: 13, fontWeight: "800", color: "#004030" },
  factSub: { fontSize: 10, color: "rgba(0,64,48,0.4)", marginTop: 2 },
  section: { paddingHorizontal: 20, paddingVertical: 20 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sectionLineSecondary: { width: 32, height: 2, backgroundColor: "#4A9782" },
  sectionBadge: { fontSize: 10, fontWeight: "700", letterSpacing: 1.6, color: "#4A9782" },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#004030" },
  stepsGrid: { gap: 12 },
  stepCard: { backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,64,48,0.05)", padding: 16 },
  stepCardDark: { backgroundColor: "#004030", borderColor: "#004030" },
  stepIconRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(74,151,130,0.1)", alignItems: "center", justifyContent: "center" },
  stepIconDark: { width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  stepNumber: { fontSize: 20, fontWeight: "800", color: "rgba(0,64,48,0.08)", marginLeft: "auto" },
  stepTitle: { fontSize: 15, fontWeight: "700", color: "#004030", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "rgba(0,64,48,0.55)", lineHeight: 18 },
  divider: { height: 1, backgroundColor: "rgba(0,64,48,0.05)", marginHorizontal: 20, marginVertical: 4 },
  coinSection: { backgroundColor: "#004030", marginHorizontal: 20, borderRadius: 16, padding: 24, alignItems: "center", marginVertical: 16 },
  coinBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#4A9782", marginBottom: 8 },
  coinTitle: { fontSize: 20, fontWeight: "800", color: "#FFF", textAlign: "center" },
  coinSub: { fontSize: 13, color: "rgba(255,255,255,0.5)", textAlign: "center", marginTop: 4, marginBottom: 16 },
  coinCards: { gap: 8, width: "100%" },
  coinCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, alignItems: "center" },
  coinCardAccent: { backgroundColor: "rgba(74,151,130,0.2)" },
  coinCardTitle: { fontSize: 16, fontWeight: "800", color: "#FFF", marginTop: 6 },
  coinCardSub: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  coinExample: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 16, marginTop: 12 },
  coinExampleText: { fontSize: 12, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 18 },
  paymentBadge: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#4A9782", marginBottom: 4 },
  paymentTitle: { fontSize: 20, fontWeight: "700", color: "#004030", marginBottom: 16 },
  paymentGrid: { gap: 10 },
  paymentCard: { backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,64,48,0.05)", padding: 20, alignItems: "center" },
  paymentName: { fontSize: 15, fontWeight: "700", color: "#004030", marginTop: 8 },
  paymentNote: { fontSize: 11, color: "rgba(0,64,48,0.4)", marginTop: 2 },
  ctaSection: { paddingHorizontal: 20, gap: 12 },
  ctaCard: { backgroundColor: "rgba(74,151,130,0.1)", borderRadius: 16, padding: 24 },
  ctaCardDark: { backgroundColor: "#004030" },
  ctaTitle: { fontSize: 18, fontWeight: "700", color: "#004030", marginTop: 8 },
  ctaDesc: { fontSize: 13, color: "rgba(0,64,48,0.6)", lineHeight: 18, marginTop: 4 },
  ctaBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#4A9782", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, marginTop: 16, alignSelf: "flex-start" },
  ctaBtnLight: { backgroundColor: "rgba(255,255,255,0.1)" },
  ctaBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
