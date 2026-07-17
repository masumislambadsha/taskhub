import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, ISubmission, PaginatedResponse } from "../../src/types";

export default function Dashboard() {
  const [firstName, setFirstName] = useState("");
  const [coins, setCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  async function loadUser() {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setFirstName(u.name?.split(" ")[0] || u.name || "");
        setCoins(u.coins ?? 0);
      } catch {}
    }
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const tasksQuery = useQuery({
    queryKey: ["buyer-dashboard-tasks"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ITask>>("/api/v1/tasks", { params: { page: 1, limit: 1000 } });
      return data;
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ["buyer-dashboard-submissions"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params: { page: 1, limit: 1000 } });
      return data;
    },
  });

  const tasks = tasksQuery.data?.data ?? [];
  const submissions = submissionsQuery.data?.data ?? [];

  const totalTasks = tasks.length;
  const pendingReviews = submissions.filter((s) => s.status === "pending").length;
  const openTasks = tasks.filter((t) => t.status === "open").length;
  const closedTasks = tasks.filter((t) => t.status === "closed").length;
  const approvedSubs = submissions.filter((s) => s.status === "approved").length;
  const rejectedSubs = submissions.filter((s) => s.status === "rejected").length;
  const coinsSpent = tasks.reduce((sum, t) => sum + (t.payableAmount || 0), 0);

  const approvalRate = submissions.length > 0 ? Math.round((approvedSubs / submissions.length) * 100) : 0;

  const pendingSubmissions = submissions.filter((s) => s.status === "pending");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([tasksQuery.refetch(), submissionsQuery.refetch()]);
    await loadUser();
    setRefreshing(false);
  }, []);

  const isLoading = tasksQuery.isLoading || submissionsQuery.isLoading;
  const isError = tasksQuery.isError || submissionsQuery.isError;

  if (isLoading) return <Spinner message="Loading dashboard..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.retry}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>Welcome back, {firstName}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      <Button
        title="Create Task"
        onPress={() => router.push("/(buyer)/tasks")}
        style={styles.createBtn}
      />

      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Ionicons name="list-outline" size={24} color={COLORS.primary} />
          <Text style={styles.kpiValue}>{totalTasks}</Text>
          <Text style={styles.kpiLabel}>Total Tasks</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="time-outline" size={24} color={COLORS.warning} />
          <Text style={styles.kpiValue}>{pendingReviews}</Text>
          <Text style={styles.kpiLabel}>Pending Reviews</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="cash-outline" size={24} color={COLORS.secondary} />
          <Text style={styles.kpiValue}>{coins}</Text>
          <Text style={styles.kpiLabel}>Coins Balance</Text>
        </Card>
        <Card variant="accent" style={styles.kpiCardAccent}>
          <Ionicons name="trending-down-outline" size={24} color={COLORS.white} />
          <Text style={styles.kpiValueAccent}>{coinsSpent}</Text>
          <Text style={styles.kpiLabelAccent}>Coins Spent</Text>
        </Card>
      </View>

      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Task Activity (7 days)</Text>
        <View style={styles.barChart}>
          {[30, 55, 25, 70, 45, 85, 60].map((h, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.bar, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <View style={styles.overviewRow}>
        <Card style={styles.overviewCard}>
          <Text style={styles.sectionTitle}>Approval Rate</Text>
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${approvalRate}%` }]} />
            </View>
            <Text style={styles.progressText}>{approvalRate}%</Text>
          </View>
        </Card>
        <Card style={styles.miniStatsCard}>
          <Text style={styles.sectionTitle}>Mini Stats</Text>
          <View style={styles.miniStatRow}>
            <Text style={styles.miniStat}><Text style={styles.miniStatVal}>{openTasks}</Text> Open</Text>
            <Text style={styles.miniStat}><Text style={styles.miniStatVal}>{closedTasks}</Text> Closed</Text>
          </View>
          <View style={styles.miniStatRow}>
            <Text style={styles.miniStat}><Text style={[styles.miniStatVal, { color: COLORS.success }]}>{approvedSubs}</Text> Approved</Text>
            <Text style={styles.miniStat}><Text style={[styles.miniStatVal, { color: COLORS.danger }]}>{rejectedSubs}</Text> Rejected</Text>
          </View>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Submissions to Review</Text>
      {pendingSubmissions.length > 0 ? (
        pendingSubmissions.slice(0, 5).map((s) => (
          <Card key={s._id} style={styles.reviewCard}>
            <View style={styles.reviewRow}>
              <View>
                <Text style={styles.reviewWorker}>{s.workerName}</Text>
                <Text style={styles.reviewTask}>{s.taskTitle}</Text>
              </View>
              <Badge label="pending" variant="pending" />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="No submissions to review" message="Pending submissions will appear here" />
      )}

      <Text style={styles.sectionTitle}>Quick Links</Text>
      <View style={styles.quickLinks}>
        <TouchableOpacity style={styles.quickLinkCard} onPress={() => router.push("/(buyer)/tasks")}>
          <Ionicons name="list-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickLabel}>My Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkCard} onPress={() => router.push("/(buyer)/submissions")}>
          <Ionicons name="document-text-outline" size={28} color={COLORS.secondary} />
          <Text style={styles.quickLabel}>Submissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkCard} onPress={() => router.push("/(buyer)/coins")}>
          <Ionicons name="diamond-outline" size={28} color={COLORS.warning} />
          <Text style={styles.quickLabel}>Buy Coins</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkCard} onPress={() => router.push("/(buyer)/payments")}>
          <Ionicons name="receipt-outline" size={28} color={COLORS.danger} />
          <Text style={styles.quickLabel}>Payments</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  retry: { fontSize: 16, color: COLORS.primary, marginTop: 8, fontWeight: "600", textAlign: "center" },
  headerRow: { marginBottom: 20 },
  greeting: { fontSize: 24, fontWeight: "800", color: COLORS.primary },
  dateText: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, marginTop: 4 },
  createBtn: { marginBottom: 20 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  kpiCard: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary, marginTop: 8 },
  kpiLabel: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary, opacity: 0.6, marginTop: 4, textAlign: "center" },
  kpiCardAccent: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValueAccent: { fontSize: 28, fontWeight: "800", color: COLORS.white, marginTop: 8 },
  kpiLabelAccent: { fontSize: 12, fontWeight: "500", color: COLORS.white, opacity: 0.8, marginTop: 4, textAlign: "center" },
  chartCard: { marginBottom: 20, paddingVertical: 16 },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100, marginTop: 12, paddingHorizontal: 4 },
  barWrapper: { alignItems: "center", flex: 1 },
  bar: { width: 8, borderRadius: 4, backgroundColor: COLORS.primary, minHeight: 4 },
  chartLabel: { fontSize: 10, color: COLORS.textSecondary, opacity: 0.6, textAlign: "center", marginTop: 6 },
  overviewRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  overviewCard: { flex: 1, paddingVertical: 16 },
  progressWrap: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 },
  progressBg: { flex: 1, height: 12, borderRadius: 6, backgroundColor: "#0040301A" },
  progressFill: { height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  progressText: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  miniStatsCard: { flex: 1, paddingVertical: 16 },
  miniStatRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  miniStat: { fontSize: 13, color: COLORS.textSecondary },
  miniStatVal: { fontWeight: "700", color: COLORS.primary },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  reviewCard: { marginBottom: 8 },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewWorker: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  reviewTask: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quickLinks: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickLinkCard: { width: "47%", backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: "#0040300D", padding: 20, alignItems: "center" },
  quickLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 8 },
});
