import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { ISubmission, PaginatedResponse } from "../../src/types";

const TABS = ["All", "Pending", "Approved", "Rejected"] as const;
type Tab = (typeof TABS)[number];

const STATUS_MAP: Record<Tab, string> = {
  All: "",
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
};

export default function Submissions() {
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const statusParam = STATUS_MAP[activeTab];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["worker-submissions", page, activeTab],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (statusParam) params.status = statusParam;
      const res = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params });
      return res.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleTabChange = useCallback((tab: Tab) => {
    setActiveTab(tab);
    setPage(1);
  }, []);

  const renderSubmission = useCallback(
    ({ item }: { item: ISubmission }) => (
      <Card style={styles.subCard}>
        <View style={styles.subHeader}>
          <Text style={styles.subTaskTitle} numberOfLines={1}>{item.taskTitle}</Text>
          <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
        </View>
        <View style={styles.subMeta}>
          <Text style={styles.payoutText}>{item.payableAmount} coins</Text>
          <Text style={styles.subDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </Card>
    ),
    [],
  );

  if (isLoading && !data) return <Spinner message="Loading submissions..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load submissions</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderSubmission}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState title="No submissions" message={`You have no ${activeTab.toLowerCase()} submissions`} />}
        ListFooterComponent={
          data && data.page < data.pages ? (
            <View style={styles.loadMore}>
              <Button title="Load More" onPress={() => setPage((p) => p + 1)} variant="outline" />
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  tabRow: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, marginBottom: 12, borderRadius: 12, backgroundColor: COLORS.surface, padding: 4, borderWidth: 1, borderColor: "#0040300D" },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  tabTextActive: { color: "#FFFFFF" },
  list: { padding: 16, paddingTop: 4 },
  subCard: { marginBottom: 12 },
  subHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  subTaskTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: 8 },
  subMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  payoutText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  subDate: { fontSize: 13, color: COLORS.textSecondary },
  loadMore: { paddingVertical: 16, alignItems: "center" },
});
