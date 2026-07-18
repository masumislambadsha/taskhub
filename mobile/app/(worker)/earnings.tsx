import { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COINS_PER_DOLLAR_WITHDRAW } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { ISubmission } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Earnings() {
  const [coins, setCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadCoins = useCallback(async () => {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setCoins(u.coins ?? 0);
      } catch {}
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCoins();
    }, [])
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["worker-earnings"],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<ISubmission, 'submissions'>>("/api/v1/submissions", { params: { page: 1, limit: 1000 } });
      return res.data;
    },
  });

  const submissions = data?.submissions ?? [];
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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load earnings</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      <Card variant="accent" style={styles.accentCard}>
        <Text style={styles.accentLabel}>Available Coins</Text>
        <Text style={styles.accentValue}>{coins}</Text>
        <Text style={styles.accentSubtext}>≈ ${(coins / COINS_PER_DOLLAR_WITHDRAW).toFixed(2)} USD</Text>
      </Card>

      <View style={styles.earningsRow}>
        <Card style={styles.earningsCard}>
          <Text style={styles.earningsValue}>{lifetimeEarnings}</Text>
          <Text style={styles.earningsLabel}>Lifetime Earnings (coins)</Text>
        </Card>
        <Card style={styles.earningsCard}>
          <Text style={styles.earningsValue}>{pendingCoins}</Text>
          <Text style={styles.earningsLabel}>Pending Coins</Text>
        </Card>
      </View>

      <Card style={styles.usdCard}>
        <Text style={styles.usdLabel}>Total USD Value</Text>
        <Text style={styles.usdValue}>${(lifetimeEarnings / COINS_PER_DOLLAR_WITHDRAW).toFixed(2)}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Submission History</Text>
      {approvedSubs.length > 0 ? (
        approvedSubs.map((s) => (
          <Card key={s._id} style={styles.histCard}>
            <View style={styles.histHeader}>
              <Text style={styles.histTitle} numberOfLines={1}>{s.taskTitle}</Text>
              <Text style={styles.histAmount}>+{s.payableAmount}</Text>
            </View>
            <View style={styles.histMeta}>
              <Badge label={s.status} variant="approved" />
              <Text style={styles.histDate}>{new Date(s.createdAt).toLocaleDateString()}</Text>
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
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  accentCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  accentLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  accentValue: {
    fontSize: 42,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  accentSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  earningsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  earningsCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  earningsValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#004030',
  },
  earningsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  usdCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 24,
  },
  usdLabel: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  usdValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#004030',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  histCard: {
    marginBottom: 8,
  },
  histHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  histTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  histAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  histMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  histDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
});
