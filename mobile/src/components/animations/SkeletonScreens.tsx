import { View, StyleSheet, ScrollView } from "react-native";
import Skeleton from "./Skeleton";

export function SkeletonDashboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Skeleton width="55%" height={22} style={{ marginBottom: 4 }} />
      <Skeleton width="35%" height={14} style={{ marginBottom: 20 }} />
      <Skeleton width="100%" height={48} borderRadius={12} style={{ marginBottom: 20 }} />
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.statCard}>
            <Skeleton width={24} height={24} borderRadius={12} style={{ marginBottom: 8 }} />
            <Skeleton width="50%" height={28} style={{ marginBottom: 4 }} />
            <Skeleton width="70%" height={12} />
          </View>
        ))}
      </View>
      <View style={styles.chartsRow}>
        <View style={styles.chartCard}>
          <Skeleton width="80%" height={18} style={{ marginBottom: 12 }} />
          <View style={{ flexDirection: "row", gap: 4, height: 80, alignItems: "flex-end" }}>
            {[40, 65, 30, 80, 55, 90, 45].map((h, i) => (
              <Skeleton key={i} width={8} height={h} borderRadius={4} />
            ))}
          </View>
        </View>
        <View style={styles.chartCard}>
          <Skeleton width="80%" height={18} style={{ marginBottom: 12 }} />
          <Skeleton width="100%" height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <Skeleton width="40%" height={12} />
        </View>
      </View>
      <Skeleton width="50%" height={18} style={{ marginBottom: 12 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.rowCard}>
          <Skeleton width="60%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="30%" height={12} />
        </View>
      ))}
      <Skeleton width="50%" height={18} style={{ marginVertical: 12 }} />
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.actionBtn}>
            <Skeleton width={28} height={28} borderRadius={14} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={12} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function SkeletonTaskList() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Skeleton width="40%" height={22} style={{ marginBottom: 4 }} />
      <Skeleton width="60%" height={14} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={44} borderRadius={12} style={{ marginBottom: 12 }} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={80} height={32} borderRadius={16} />
        ))}
      </View>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.taskCard}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Skeleton width={60} height={60} borderRadius={8} />
            <View style={{ flex: 1 }}>
              <Skeleton width="80%" height={16} style={{ marginBottom: 6 }} />
              <Skeleton width="50%" height={12} style={{ marginBottom: 4 }} />
              <Skeleton width="40%" height={12} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export function SkeletonListPage() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Skeleton width="40%" height={22} style={{ marginBottom: 4 }} />
      <Skeleton width="60%" height={14} style={{ marginBottom: 16 }} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.rowCard}>
          <Skeleton width="50%" height={14} />
          <Skeleton width="20%" height={14} />
        </View>
      ))}
    </ScrollView>
  );
}

export function SkeletonLeaderboard() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={[styles.statCard, { backgroundColor: "rgba(0,64,48,0.03)", marginBottom: 24 }]}>
        <Skeleton width="60%" height={28} style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height={14} style={{ marginBottom: 16 }} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={60} height={80} borderRadius={12} />
          ))}
        </View>
      </View>
      <Skeleton width="50%" height={18} style={{ marginBottom: 12 }} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <View key={i} style={[styles.rowCard, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1 }}>
            <Skeleton width="60%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="40%" height={12} />
          </View>
          <Skeleton width={60} height={14} />
        </View>
      ))}
    </ScrollView>
  );
}

export function SkeletonAdminListPage({ rows = 7 }: { rows?: number }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Skeleton width="35%" height={22} style={{ marginBottom: 4 }} />
      <Skeleton width="50%" height={14} style={{ marginBottom: 16 }} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
        {[0, 1].map((i) => (
          <Skeleton key={i} width={100} height={36} borderRadius={12} />
        ))}
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.rowCard, { flexDirection: "row", gap: 12, alignItems: "center" }]}>
          <Skeleton width={36} height={36} borderRadius={18} />
          <View style={{ flex: 1 }}>
            <Skeleton width="50%" height={14} style={{ marginBottom: 4 }} />
            <Skeleton width="30%" height={12} />
          </View>
          <Skeleton width={60} height={28} borderRadius={14} />
        </View>
      ))}
    </ScrollView>
  );
}

export function SkeletonWithdrawalPage() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <View style={[styles.statCard, { backgroundColor: "#004030", marginBottom: 20 }]}>
        <Skeleton width={24} height={24} borderRadius={12} />
        <Skeleton width="40%" height={36} style={{ marginVertical: 8 }} />
        <Skeleton width="60%" height={14} />
      </View>
      <Skeleton width="100%" height={48} borderRadius={12} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={48} borderRadius={12} style={{ marginBottom: 16 }} />
      <Skeleton width="100%" height={48} borderRadius={12} style={{ marginBottom: 16 }} />
      <Skeleton width="50%" height={18} style={{ marginVertical: 16 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.rowCard}>
          <Skeleton width="50%" height={14} style={{ marginBottom: 4 }} />
          <Skeleton width="30%" height={12} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF9E5",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  chartsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  chartCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  taskCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionBtn: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
});
