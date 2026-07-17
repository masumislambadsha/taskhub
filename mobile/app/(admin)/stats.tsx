import { ScrollView, View, Text, StyleSheet, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";

interface AdminStats {
  totalWorkers: number;
  totalBuyers: number;
  totalCoins: number;
  totalPayments: number;
  pendingWithdrawals: number;
}

export default function AdminStats() {
  const { data, isLoading, isRefetching, refetch } = useQuery<AdminStats>({
    queryKey: ["admin", "analytics"],
    queryFn: async () => {
      const { data } = await api.get<AdminStats>("/api/v1/admin/stats");
      return data;
    },
  });

  if (isLoading) return <Spinner message="Loading analytics..." />;

  const s = data!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
    >
      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>User Growth (Last 7 days)</Text>
        <View style={styles.barChart}>
          {[25, 45, 30, 60, 40, 75, 55].map((h, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.barUser, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Revenue (Last 7 days)</Text>
        <View style={styles.barChart}>
          {[50, 80, 35, 95, 60, 110, 70].map((h, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.barRevenue, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Submissions (Last 7 days)</Text>
        <View style={styles.barChart}>
          {[15, 30, 22, 45, 28, 55, 35].map((h, i) => (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.barSubmissions, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Ionicons name="people-outline" size={28} color={COLORS.primary} />
          <Text style={styles.summaryValue}>{s.totalWorkers + s.totalBuyers}</Text>
          <Text style={styles.summaryLabel}>Total Users</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="cash-outline" size={28} color={COLORS.success} />
          <Text style={styles.summaryValue}>{s.totalCoins.toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Coins</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="trending-up-outline" size={28} color={COLORS.warning} />
          <Text style={styles.summaryValue}>${s.totalPayments.toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>Revenue</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Ionicons name="time-outline" size={28} color={COLORS.danger} />
          <Text style={styles.summaryValue}>{s.pendingWithdrawals}</Text>
          <Text style={styles.summaryLabel}>Pending Withdrawals</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  chartCard: { marginBottom: 20, paddingVertical: 16 },
  barChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, marginTop: 8, paddingHorizontal: 4 },
  barWrapper: { alignItems: "center", flex: 1 },
  barUser: { width: 10, borderRadius: 4, backgroundColor: COLORS.primary, minHeight: 4 },
  barRevenue: { width: 10, borderRadius: 4, backgroundColor: COLORS.success, minHeight: 4 },
  barSubmissions: { width: 10, borderRadius: 4, backgroundColor: COLORS.warning, minHeight: 4 },
  chartLabel: { fontSize: 10, color: COLORS.textSecondary, opacity: 0.6, textAlign: "center", marginTop: 6 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: { width: "47%", alignItems: "center", paddingVertical: 20 },
  summaryValue: { fontSize: 24, fontWeight: "800", color: COLORS.text, marginTop: 8 },
  summaryLabel: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary, opacity: 0.6, marginTop: 4 },
});
