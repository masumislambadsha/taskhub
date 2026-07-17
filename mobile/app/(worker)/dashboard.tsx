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
import type { ISubmission, PaginatedResponse } from "../../src/types";

export default function Dashboard() {
  const [firstName, setFirstName] = useState("");
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

  const submissionsQuery = useQuery({
    queryKey: ["worker-dashboard-submissions"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params: { page: 1, limit: 100 } });
      return data;
    },
  });

  const meQuery = useQuery({
    queryKey: ["worker-dashboard-me"],
    queryFn: async () => {
      const { data } = await api.get<{ data: { coins: number } }>("/api/v1/auth/me");
      return data.data;
    },
  });

  const submissions = submissionsQuery.data?.data ?? [];
  const totalSubmissions = submissions.length;
  const approved = submissions.filter((s) => s.status === "approved").length;
  const pending = submissions.filter((s) => s.status === "pending").length;
  const coins = meQuery.data?.coins ?? 0;

  const recentSubmissions = submissions.slice(-6).reverse();

  const approvalRate = totalSubmissions > 0 ? Math.round((approved / totalSubmissions) * 100) : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([submissionsQuery.refetch(), meQuery.refetch()]);
    await loadUser();
    setRefreshing(false);
  }, []);

  const isLoading = submissionsQuery.isLoading || meQuery.isLoading;
  const isError = submissionsQuery.isError || meQuery.isError;

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
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>Welcome back, {firstName}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>
      </View>

      <Button
        title="Browse Tasks"
        onPress={() => router.push("/(worker)/tasks")}
        style={styles.browseBtn}
      />

      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Ionicons name="document-text-outline" size={24} color={COLORS.primary} />
          <Text style={styles.kpiValue}>{totalSubmissions}</Text>
          <Text style={styles.kpiLabel}>Total Submissions</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="checkmark-circle-outline" size={24} color={COLORS.secondary} />
          <Text style={styles.kpiValue}>{approved}</Text>
          <Text style={styles.kpiLabel}>Approved</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="time-outline" size={24} color={COLORS.warning} />
          <Text style={styles.kpiValue}>{pending}</Text>
          <Text style={styles.kpiLabel}>Pending Review</Text>
        </Card>
        <Card variant="accent" style={styles.kpiCardAccent}>
          <Ionicons name="cash-outline" size={24} color={COLORS.white} />
          <Text style={styles.kpiValueAccent}>{coins}</Text>
          <Text style={styles.kpiLabelAccent}>Available Coins</Text>
        </Card>
      </View>

      <View style={styles.row2}>
        <Card style={styles.earningsCard}>
          <Text style={styles.sectionTitle}>Earnings This Week</Text>
          <View style={styles.barChart}>
            {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
              <View key={i} style={styles.barWrapper}>
                <View style={[styles.bar, { height: h }]} />
              </View>
            ))}
          </View>
          <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
        </Card>
        <Card style={styles.perfCard}>
          <Text style={styles.sectionTitle}>Performance</Text>
          <View style={styles.progressWrap}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${approvalRate}%` }]} />
            </View>
            <Text style={styles.progressText}>{approvalRate}%</Text>
          </View>
          <Text style={styles.perfLabel}>Approval Rate</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Recent Submissions</Text>
      {recentSubmissions.length > 0 ? (
        recentSubmissions.map((s) => (
          <Card key={s._id} style={styles.subCard}>
            <View style={styles.subRow}>
              <Text style={styles.subTask} numberOfLines={1}>{s.taskTitle}</Text>
              <Badge label={s.status} variant={s.status as "pending" | "approved" | "rejected"} />
            </View>
            <Text style={styles.subDate}>{new Date(s.createdAt).toLocaleDateString()}</Text>
          </Card>
        ))
      ) : (
        <EmptyState title="No submissions yet" message="Submit work on tasks to see them here" />
      )}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/(worker)/tasks")}>
          <Ionicons name="search-outline" size={28} color={COLORS.primary} />
          <Text style={styles.quickLabel}>Browse Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/(worker)/submissions")}>
          <Ionicons name="document-text-outline" size={28} color={COLORS.secondary} />
          <Text style={styles.quickLabel}>Submissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/(worker)/earnings")}>
          <Ionicons name="cash-outline" size={28} color={COLORS.warning} />
          <Text style={styles.quickLabel}>Earnings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} onPress={() => router.push("/(worker)/withdrawals")}>
          <Ionicons name="card-outline" size={28} color={COLORS.danger} />
          <Text style={styles.quickLabel}>Withdraw</Text>
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
  headerLeft: {},
  greeting: { fontSize: 24, fontWeight: "800", color: COLORS.primary },
  dateText: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, marginTop: 4 },
  browseBtn: { marginBottom: 20 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 20 },
  kpiCard: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary, marginTop: 8 },
  kpiLabel: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary, opacity: 0.6, marginTop: 4, textAlign: "center" },
  kpiCardAccent: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValueAccent: { fontSize: 28, fontWeight: "800", color: COLORS.white, marginTop: 8 },
  kpiLabelAccent: { fontSize: 12, fontWeight: "500", color: COLORS.white, opacity: 0.8, marginTop: 4, textAlign: "center" },
  row2: { flexDirection: "row", gap: 12, marginBottom: 24 },
  earningsCard: { flex: 1, paddingVertical: 16 },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100, marginTop: 12, paddingHorizontal: 4 },
  barWrapper: { alignItems: "center", flex: 1 },
  bar: { width: 8, borderRadius: 4, backgroundColor: COLORS.primary, minHeight: 4 },
  chartLabel: { fontSize: 10, color: COLORS.textSecondary, opacity: 0.6, textAlign: "center", marginTop: 6 },
  perfCard: { flex: 1, paddingVertical: 16 },
  progressWrap: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 },
  progressBg: { flex: 1, height: 12, borderRadius: 6, backgroundColor: "#0040301A" },
  progressFill: { height: 12, borderRadius: 6, backgroundColor: COLORS.primary },
  progressText: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  perfLabel: { fontSize: 12, color: COLORS.textSecondary, opacity: 0.6, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  subCard: { marginBottom: 8 },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subTask: { fontSize: 14, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: 8 },
  subDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  quickCard: { width: "47%", backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: "#0040300D", padding: 20, alignItems: "center" },
  quickLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginTop: 8 },
});
