import { ScrollView, View, Text, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

interface AdminStats {
  totalWorkers: number;
  totalBuyers: number;
  totalCoins: number;
  totalPayments: number;
  pendingWithdrawals: number;
  recentUsers: Array<{
    _id: string;
    name: string;
    email: string;
    role: string;
    coins: number;
    createdAt: string;
  }>;
}

export default function AdminDashboard() {
  const { data, isLoading, isError, isRefetching, refetch } = useQuery<AdminStats>({
    queryKey: ["admin", "stats"],
    queryFn: async () => {
      const { data } = await api.get<AdminStats>("/api/v1/admin/stats");
      return data;
    },
  });

  if (isLoading) return <Spinner message="Loading dashboard..." />;

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = data!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#004030" />}
    >
      <View style={styles.headerSection}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.subtitle}>Platform overview and key metrics</Text>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Ionicons name="people-outline" size={24} color="#004030" />
          <Text style={styles.statValue}>{s.totalWorkers}</Text>
          <Text style={styles.statLabel}>Total Workers</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cart-outline" size={24} color="#4A9782" />
          <Text style={styles.statValue}>{s.totalBuyers}</Text>
          <Text style={styles.statLabel}>Total Buyers</Text>
        </Card>
        <Card style={styles.statCard}>
          <Ionicons name="cash-outline" size={24} color="#F59E0B" />
          <Text style={styles.statValue}>{s.totalCoins.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Coins in System</Text>
        </Card>
        <Card variant="accent" style={styles.statCard}>
          <Ionicons name="trending-up-outline" size={24} color="#FFFFFF" />
          <Text style={styles.statValueWhite}>${s.totalPayments.toFixed(2)}</Text>
          <Text style={styles.statLabelWhite}>Total Revenue</Text>
        </Card>
      </View>

      <Text style={styles.sectionTitle}>Recent Users</Text>
      {s.recentUsers.length > 0 ? (
        s.recentUsers.map((u) => (
          <Card key={u._id} style={styles.userCard}>
            <View style={styles.userRow}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{u.name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
              </View>
              <View style={styles.userMeta}>
                <Badge
                  label={u.role}
                  variant={u.role === "admin" ? "active" : u.role === "buyer" ? "approved" : "pending"}
                />
                <Text style={styles.userCoins}>{u.coins} coins</Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <EmptyState title="No users yet" message="Users will appear here once they register" />
      )}

      <Card variant="accent" style={styles.withdrawalCard}>
        <Text style={styles.withdrawalLabel}>Pending Withdrawals</Text>
        <Text style={styles.withdrawalValue}>{s.pendingWithdrawals}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
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
  headerSection: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#004030',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  userCard: {
    marginBottom: 8,
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  userEmail: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  userMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  userCoins: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  withdrawalCard: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 24,
  },
  withdrawalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  withdrawalValue: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
});
