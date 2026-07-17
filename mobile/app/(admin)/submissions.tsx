import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

interface ISubmission {
  _id: string;
  taskTitle: string;
  workerName: string;
  workerEmail: string;
  payableAmount: number;
  status: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

const TABS = ["All", "Pending", "Approved", "Rejected"] as const;
type Tab = (typeof TABS)[number];

const STATUS_MAP: Record<Tab, string> = {
  All: "",
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
};

export default function AdminSubmissions() {
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [page, setPage] = useState(1);

  const statusParam = STATUS_MAP[activeTab];

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<PaginatedResponse<ISubmission>>({
    queryKey: ["admin", "submissions", page, activeTab],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusParam) params.status = statusParam;
      const { data } = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params });
      return data;
    },
  });

  const submissions = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  const renderSubmission = ({ item }: { item: ISubmission }) => (
    <Card style={styles.subCard}>
      <View style={styles.subHeader}>
        <Text style={styles.subWorker}>{item.workerName}</Text>
        <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
      </View>
      <Text style={styles.subTask}>{item.taskTitle}</Text>
      <View style={styles.subFooter}>
        <Text style={styles.subDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.subAmount}>{item.payableAmount} coins</Text>
      </View>
    </Card>
  );

  if (isLoading) return <Spinner message="Loading submissions..." />;

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => { setActiveTab(tab); setPage(1); }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={submissions}
        keyExtractor={(item) => item._id}
        renderItem={renderSubmission}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No submissions" message={`No ${activeTab.toLowerCase()} submissions found`} />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footerLoader}><Spinner size="small" /></View> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 12, borderRadius: 12, backgroundColor: COLORS.surface, padding: 4, borderWidth: 1, borderColor: "#0040300D" },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabTextActive: { color: "#FFFFFF" },
  list: { padding: 16, paddingTop: 4, paddingBottom: 32 },
  subCard: { marginBottom: 12 },
  subHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subWorker: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  subTask: { fontSize: 14, color: COLORS.textSecondary, marginTop: 6 },
  subFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  subDate: { fontSize: 12, color: COLORS.textSecondary },
  subAmount: { fontSize: 14, fontWeight: "700", color: COLORS.primary },
  footerLoader: { paddingVertical: 16 },
});
