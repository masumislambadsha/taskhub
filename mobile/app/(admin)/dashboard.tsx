import { ScrollView, View, Text, StyleSheet, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
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
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load dashboard</Text>
        <TouchableOpacity onPress={() => refetch()}>
          <Text style={styles.retry}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const s = data!;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={COLORS.primary} />}
    >
      <View style={styles.headerSection}>
        <Text style={styles.heading}>Admin Dashboard</Text>
        <Text style={styles.subheading}>Platform overview and key metrics</Text>
      </View>

      <View style={styles.grid}>
        <Card style={styles.kpiCard}>
          <Ionicons name="people-outline" size={24} color={COLORS.primary} />
          <Text style={styles.kpiValue}>{s.totalWorkers}</Text>
          <Text style={styles.kpiLabel}>Total Workers</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="cart-outline" size={24} color={COLORS.secondary} />
          <Text style={styles.kpiValue}>{s.totalBuyers}</Text>
          <Text style={styles.kpiLabel}>Total Buyers</Text>
        </Card>
        <Card style={styles.kpiCard}>
          <Ionicons name="cash-outline" size={24} color={COLORS.warning} />
          <Text style={styles.kpiValue}>{s.totalCoins.toLocaleString()}</Text>
          <Text style={styles.kpiLabel}>Coins in System</Text>
        </Card>
        <Card variant="accent" style={styles.kpiCardAccent}>
          <Ionicons name="trending-up-outline" size={24} color={COLORS.white} />
          <Text style={styles.kpiValueAccent}>${s.totalPayments.toFixed(2)}</Text>
          <Text style={styles.kpiLabelAccent}>Total Revenue</Text>
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

      <Card variant="accent" style={styles.pendingCard}>
        <Text style={styles.pendingTitle}>Pending Withdrawals</Text>
        <Text style={styles.pendingValue}>{s.pendingWithdrawals}</Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  retry: { fontSize: 16, color: COLORS.primary, marginTop: 8, fontWeight: "600", textAlign: "center" },
  headerSection: { marginBottom: 24 },
  heading: { fontSize: 24, fontWeight: "800", color: COLORS.primary },
  subheading: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 24 },
  kpiCard: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary, marginTop: 8 },
  kpiLabel: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary, opacity: 0.6, marginTop: 4, textAlign: "center" },
  kpiCardAccent: { width: "47%", alignItems: "center", paddingVertical: 20 },
  kpiValueAccent: { fontSize: 28, fontWeight: "800", color: COLORS.white, marginTop: 8 },
  kpiLabelAccent: { fontSize: 12, fontWeight: "500", color: COLORS.white, opacity: 0.8, marginTop: 4, textAlign: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  userCard: { marginBottom: 8 },
  userRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  userEmail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  userMeta: { alignItems: "flex-end", gap: 4 },
  userCoins: { fontSize: 12, color: COLORS.textSecondary },
  pendingCard: { marginTop: 24, alignItems: "center", paddingVertical: 24 },
  pendingTitle: { fontSize: 14, color: COLORS.white, opacity: 0.8 },
  pendingValue: { fontSize: 32, fontWeight: "800", color: COLORS.white, marginTop: 4 },
});
