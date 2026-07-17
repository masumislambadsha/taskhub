import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS, COINS_PER_DOLLAR_WITHDRAW } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { ISubmission, PaginatedResponse } from "../../src/types";

export default function Earnings() {
  const [coins, setCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCoins();
    }, [])
  );

  async function loadCoins() {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setCoins(u.coins ?? 0);
      } catch {}
    }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["worker-earnings"],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params: { page: 1, limit: 1000 } });
      return res.data;
    },
  });

  const submissions = data?.data ?? [];
  const lifetimeEarnings = submissions.reduce((sum, s) => sum + (s.payableAmount || 0), 0);
  const pendingCoins = submissions.filter((s) => s.status === "pending").reduce((sum, s) => sum + (s.payableAmount || 0), 0);
  const approvedSubs = submissions.filter((s) => s.status === "approved");

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await loadCoins();
    setRefreshing(false);
  }, [refetch]);

  if (isLoading) return <Spinner message="Loading earnings..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load earnings</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <Card variant="accent" style={styles.coinCard}>
        <Text style={styles.coinLabel}>Available Coins</Text>
        <Text style={styles.coinAmount}>{coins}</Text>
        <Text style={styles.coinUsd}>≈ ${(coins / COINS_PER_DOLLAR_WITHDRAW).toFixed(2)} USD</Text>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{lifetimeEarnings}</Text>
          <Text style={styles.statLabel}>Lifetime Earnings (coins)</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{pendingCoins}</Text>
          <Text style={styles.statLabel}>Pending Coins</Text>
        </Card>
      </View>

      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total USD Value</Text>
        <Text style={styles.totalValue}>${(lifetimeEarnings / COINS_PER_DOLLAR_WITHDRAW).toFixed(2)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Submission History</Text>
      {approvedSubs.length > 0 ? (
        approvedSubs.map((s) => (
          <Card key={s._id} style={styles.historyCard}>
            <View style={styles.historyRow}>
              <Text style={styles.historyTask} numberOfLines={1}>{s.taskTitle}</Text>
              <Text style={styles.historyAmount}>+{s.payableAmount}</Text>
            </View>
            <View style={styles.historyMeta}>
              <Badge label={s.status} variant="approved" />
              <Text style={styles.historyDate}>{new Date(s.createdAt).toLocaleDateString()}</Text>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="No earnings yet" message="Complete tasks to start earning coins" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  coinCard: { alignItems: "center", paddingVertical: 24, marginBottom: 16 },
  coinLabel: { fontSize: 14, color: COLORS.white, opacity: 0.8 },
  coinAmount: { fontSize: 42, fontWeight: "800", color: COLORS.white, marginTop: 4 },
  coinUsd: { fontSize: 14, color: COLORS.white, opacity: 0.7, marginTop: 4 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 20 },
  statValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  statLabel: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary, opacity: 0.6, marginTop: 4, textAlign: "center" },
  totalCard: { alignItems: "center", paddingVertical: 20, marginBottom: 24 },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6 },
  totalValue: { fontSize: 32, fontWeight: "800", color: COLORS.primary, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  historyCard: { marginBottom: 8 },
  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyTask: { fontSize: 14, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: 8 },
  historyAmount: { fontSize: 16, fontWeight: "800", color: COLORS.success },
  historyMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  historyDate: { fontSize: 12, color: COLORS.textSecondary },
});
