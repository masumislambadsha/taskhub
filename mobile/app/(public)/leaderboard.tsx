import { useCallback, useMemo } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";

interface LeaderboardEntry {
  _id: string;
  name: string;
  coinsEarned: number;
  approvalRate: number;
  rank: number;
  email: string;
}

const RANK_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "#FEF3C7", text: "#92400E", label: "Gold" },
  2: { bg: "#F1F5F9", text: "#475569", label: "Silver" },
  3: { bg: "#FEF2F2", text: "#991B1B", label: "Bronze" },
};

const RANK_ICONS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export default function Leaderboard() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const res = await api.get<{ data: LeaderboardEntry[] }>("/api/v1/leaderboard");
      return res.data.data;
    },
  });

  const renderItem = useCallback(({ item }: { item: LeaderboardEntry }) => {
    const rankStyle = RANK_COLORS[item.rank];
    const isTop3 = item.rank <= 3;

    return (
    <Card style={[styles.rankCard, isTop3 && styles.rankCardTop].filter(Boolean) as any}>
      <View style={styles.rankRow}>
        <View style={[styles.rankBadge, isTop3 && { backgroundColor: rankStyle?.bg }].filter(Boolean) as any}>
          {isTop3 ? (
              <Text style={styles.rankIcon}>{RANK_ICONS[item.rank]}</Text>
            ) : (
              <Text style={styles.rankNumber}>{item.rank}</Text>
            )}
          </View>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>{item.name}</Text>
            <Text style={styles.rankEmail}>{item.email}</Text>
          </View>
          <View style={styles.rankStats}>
            <Text style={styles.rankCoins}>{item.coinsEarned}</Text>
            <Text style={styles.rankCoinsLabel}>coins</Text>
          </View>
          <View style={styles.rateContainer}>
            <Text style={[styles.rateValue, isTop3 && { color: rankStyle?.text }].filter(Boolean) as any}>
              {item.approvalRate}%
            </Text>
            <Text style={styles.rateLabel}>rate</Text>
          </View>
        </View>
      </Card>
    );
  }, []);

  if (isLoading) return <Spinner message="Loading leaderboard..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load leaderboard</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <Text style={styles.headerSubtitle}>Top workers by earnings</Text>
      </View>

      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor="#004030" />}
        ListEmptyComponent={<EmptyState title="No data yet" message="Leaderboard will populate as workers complete tasks" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9E5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF9E5', padding: 24 },
  errorText: { fontSize: 16, color: '#004030', textAlign: 'center' },
  headerBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#00281D' },
  headerSubtitle: { fontSize: 14, color: '#004030', marginTop: 2 },
  list: { padding: 16, paddingTop: 4 },
  rankCard: { marginBottom: 10 },
  rankCardTop: { borderColor: '#DCD0A8', borderWidth: 1.5 },
  rankRow: { flexDirection: 'row', alignItems: 'center' },
  rankBadge: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#0040300D", justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  rankIcon: { fontSize: 20 },
  rankNumber: { fontSize: 16, fontWeight: '700', color: '#004030' },
  rankInfo: { flex: 1 },
  rankName: { fontSize: 15, fontWeight: '700', color: '#00281D' },
  rankEmail: { fontSize: 11, color: '#004030', marginTop: 1 },
  rankStats: { alignItems: 'center', marginRight: 16 },
  rankCoins: { fontSize: 18, fontWeight: '800', color: '#004030' },
  rankCoinsLabel: { fontSize: 10, color: '#004030' },
  rateContainer: { alignItems: 'center' },
  rateValue: { fontSize: 16, fontWeight: '700', color: '#00281D' },
  rateLabel: { fontSize: 10, color: '#004030' },
});
