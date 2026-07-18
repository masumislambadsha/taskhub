import { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, ISubmission } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Dashboard() {
  const [firstName, setFirstName] = useState("");
  const [coins, setCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadUser = useCallback(async () => {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setFirstName(u.name?.split(" ")[0] || u.name || "");
        setCoins(u.coins ?? 0);
      } catch {}
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

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
      const { data } = await api.get<PaginatedResponse<ITask, 'tasks'>>("/api/v1/tasks", { params: { page: 1, limit: 1000 } });
      return data;
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ["buyer-dashboard-submissions"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ISubmission, 'submissions'>>("/api/v1/submissions", { params: { page: 1, limit: 1000 } });
      return data;
    },
  });

const tasks = tasksQuery.data?.tasks ?? [];
const submissions = submissionsQuery.data?.submissions ?? [];

  const totalTasks = tasks.length;
  const pendingReviews = submissions.filter((s) => s.status === "pending").length;
  const openTasks = tasks.filter((t) => t.status === "open").length;
  const closedTasks = tasks.filter((t) => t.status === "closed").length;
  const approvedSubs = submissions.filter((s) => s.status === "approved").length;
  const rejectedSubs = submissions.filter((s) => s.status === "rejected").length;
  const coinsSpent = tasks.reduce((sum, t) => sum + (t.payableAmount || 0), 0);

  const approvalRate = submissions.length > 0 ? Math.round((approvedSubs / submissions.length) * 100) : 0;

  const pendingSubmissions = submissions.filter((s) => s.status === "pending");

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      <View style={styles.greetingSection}>
        <Text style={styles.greetingText}>Welcome back, {firstName}</Text>
        <Text style={styles.dateText}>{dateStr}</Text>
      </View>

      <Button
        title="Create Task"
        onPress={() => router.push("/(buyer)/tasks")}
        style={styles.createTaskBtn}
      />

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Ionicons name="list-outline" size={24} color="#004030" />
          <Text style={styles.statValue}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Total Tasks</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{pendingReviews}</Text>
          <Text style={styles.statLabel}>Pending Reviews</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cash-outline" size={24} color="#4A9782" />
          <Text style={styles.statValue}>{coins}</Text>
          <Text style={styles.statLabel}>Coins Balance</Text>
        </Card>
        <Card variant="accent" style={styles.statCard}>
          <Ionicons name="trending-down-outline" size={24} color="#FFFFFF" />
          <Text style={styles.statValueWhite}>{coinsSpent}</Text>
          <Text style={styles.statLabelWhite}>Coins Spent</Text>
        </Card>
      </View>

      <Card style={styles.activityCard}>
        <Text style={styles.sectionTitle}>Task Activity (7 days)</Text>
        <View style={styles.chartContainer}>
          {[30, 55, 25, 70, 45, 85, 60].map((h, i) => (
            <View key={i} style={styles.chartBarWrapper}>
              <View style={[styles.chartBar, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <View style={styles.rateRow}>
        <Card style={styles.rateCard}>
          <Text style={styles.sectionTitle}>Approval Rate</Text>
          <View style={styles.approvalRow}>
            <View style={styles.approvalBarBg}>
              <View style={[styles.approvalBarFill, { width: `${approvalRate}%` }]} />
            </View>
            <Text style={styles.approvalPct}>{approvalRate}%</Text>
          </View>
        </Card>
        <Card style={styles.rateCard}>
          <Text style={styles.sectionTitle}>Mini Stats</Text>
          <View style={styles.miniStatsRow}>
            <Text style={styles.miniStatText}><Text style={styles.miniStatBold}>{openTasks}</Text> Open</Text>
            <Text style={styles.miniStatText}><Text style={styles.miniStatBold}>{closedTasks}</Text> Closed</Text>
          </View>
          <View style={styles.miniStatsRow}>
            <Text style={styles.miniStatText}><Text style={styles.miniStatGreen}>{approvedSubs}</Text> Approved</Text>
            <Text style={styles.miniStatText}><Text style={styles.miniStatRed}>{rejectedSubs}</Text> Rejected</Text>
          </View>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Submissions to Review</Text>
      {pendingSubmissions.length > 0 ? (
        pendingSubmissions.slice(0, 5).map((s) => (
          <Card key={s._id} style={styles.reviewCard}>
            <View style={styles.reviewCardInner}>
              <View>
                <Text style={styles.reviewWorkerName}>{s.workerName}</Text>
                <Text style={styles.reviewTaskTitle}>{s.taskTitle}</Text>
              </View>
              <Badge label="pending" variant="pending" />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="No submissions to review" message="Pending submissions will appear here" />
      )}

      <Text style={styles.sectionTitle}>Quick Links</Text>
      <View style={styles.quickLinksRow}>
        <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push("/(buyer)/tasks")}>
          <Ionicons name="list-outline" size={28} color="#004030" />
          <Text style={styles.quickLinkText}>My Tasks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push("/(buyer)/submissions")}>
          <Ionicons name="document-text-outline" size={28} color="#4A9782" />
          <Text style={styles.quickLinkText}>Submissions</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push("/(buyer)/coins")}>
          <Ionicons name="diamond-outline" size={28} color="#F59E0B" />
          <Text style={styles.quickLinkText}>Buy Coins</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLinkBtn} onPress={() => router.push("/(buyer)/payments")}>
          <Ionicons name="receipt-outline" size={28} color="#EF4444" />
          <Text style={styles.quickLinkText}>Payments</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9E5',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
  },
  retryText: {
    fontSize: 16,
    color: '#004030',
    marginTop: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  greetingSection: {
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#004030',
  },
  dateText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  createTaskBtn: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#004030',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  statValueWhite: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabelWhite: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'center',
  },
  activityCard: {
    marginBottom: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 100,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 8,
    borderRadius: 8,
    backgroundColor: '#004030',
    minHeight: 4,
  },
  chartLabel: {
    fontSize: 10,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
    marginTop: 6,
  },
  rateRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  rateCard: {
    flex: 1,
    paddingVertical: 16,
  },
  approvalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  approvalBarBg: {
    flex: 1,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,64,48,0.1)',
  },
  approvalBarFill: {
    height: 12,
    borderRadius: 8,
    backgroundColor: '#004030',
  },
  approvalPct: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
  },
  miniStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  miniStatText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  miniStatBold: {
    fontWeight: '700',
    color: '#004030',
  },
  miniStatGreen: {
    fontWeight: '700',
    color: '#10B981',
  },
  miniStatRed: {
    fontWeight: '700',
    color: '#EF4444',
  },
  reviewCard: {
    marginBottom: 8,
  },
  reviewCardInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewWorkerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
  },
  reviewTaskTitle: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  quickLinksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLinkBtn: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 20,
    alignItems: 'center',
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
    marginTop: 8,
  },
});
