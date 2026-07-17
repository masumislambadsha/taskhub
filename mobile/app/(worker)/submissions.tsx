import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
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
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.taskTitle}</Text>
          <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAmount}>{item.payableAmount} coins</Text>
          <Text style={styles.cardDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      </Card>
    ),
    [],
  );

  if (isLoading && !data) return <Spinner message="Loading submissions..." />;

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load submissions</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabContainer}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => handleTabChange(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={data?.submissions ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderSubmission}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        ListEmptyComponent={<EmptyState title="No submissions" message={`You have no ${activeTab.toLowerCase()} submissions`} />}
        ListFooterComponent={
          data && data.page < data.pages ? (
            <View style={styles.loadMoreContainer}>
              <Button title="Load More" onPress={() => setPage((p) => p + 1)} variant="outline" />
            </View>
          ) : null
        }
      />
    </View>
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
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#004030',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,64,48,0.6)',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00281D',
  },
  cardDate: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
