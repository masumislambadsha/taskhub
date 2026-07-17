import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
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
    <Card style={styles.submissionCard}>
      <View style={styles.submissionHeader}>
        <Text style={styles.workerName}>{item.workerName}</Text>
        <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
      </View>
      <Text style={styles.taskTitle}>{item.taskTitle}</Text>
      <View style={styles.submissionMeta}>
        <Text style={styles.metaDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        <Text style={styles.payout}>{item.payableAmount} coins</Text>
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
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No submissions" message={`No ${activeTab.toLowerCase()} submissions found`} />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footer}><Spinner size="small" /></View> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  tabRow: {
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
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
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
  submissionCard: {
    marginBottom: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  taskTitle: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 6,
  },
  submissionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  payout: {
    fontSize: 16,
    fontWeight: '700',
    color: '#004030',
  },
  footer: {
    paddingVertical: 16,
  },
});
