import { ScrollView, View, Text, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
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

  if (isLoading || !data) return <Spinner message="Loading analytics..." />;

  const s = data;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#004030" />}
    >
      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>User Growth (Last 7 days)</Text>
        <View style={styles.chartContainer}>
          {[25, 45, 30, 60, 40, 75, 55].map((h, i) => (
            <View key={i} style={styles.chartBarWrapper}>
              <View style={[styles.chartBar, styles.chartBarGreen, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Revenue (Last 7 days)</Text>
        <View style={styles.chartContainer}>
          {[50, 80, 35, 95, 60, 110, 70].map((h, i) => (
            <View key={i} style={styles.chartBarWrapper}>
              <View style={[styles.chartBar, styles.chartBarGreenRevenue, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <Card style={styles.chartCard}>
        <Text style={styles.chartTitle}>Submissions (Last 7 days)</Text>
        <View style={styles.chartContainer}>
          {[15, 30, 22, 45, 28, 55, 35].map((h, i) => (
            <View key={i} style={styles.chartBarWrapper}>
              <View style={[styles.chartBar, styles.chartBarAmber, { height: h }]} />
            </View>
          ))}
        </View>
        <Text style={styles.chartLabel}>Mon Tue Wed Thu Fri Sat Sun</Text>
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Ionicons name="people-outline" size={28} color="#004030" />
          <Text style={styles.statValue}>{s.totalWorkers + s.totalBuyers}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cash-outline" size={28} color="#10B981" />
          <Text style={styles.statValue}>{s.totalCoins.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Coins</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={28} color="#F59E0B" />
          <Text style={styles.statValue}>${s.totalPayments.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="time-outline" size={28} color="#EF4444" />
          <Text style={styles.statValue}>{s.pendingWithdrawals}</Text>
          <Text style={styles.statLabel}>Pending Withdrawals</Text>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  chartCard: {
    marginBottom: 20,
    paddingVertical: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartBarWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  chartBar: {
    width: 10,
    borderRadius: 8,
    minHeight: 4,
  },
  chartBarGreen: {
    backgroundColor: '#004030',
  },
  chartBarGreenRevenue: {
    backgroundColor: '#10B981',
  },
  chartBarAmber: {
    backgroundColor: '#F59E0B',
  },
  chartLabel: {
    fontSize: 10,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00281D',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
});
