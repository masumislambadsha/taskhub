import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

interface IActivity {
  _id: string;
  action: string;
  actorName: string;
  actorEmail: string;
  details: string;
  createdAt: string;
}

export default function AdminActivity() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<{ data: IActivity[]; total: number; page: number; pages: number }>({
    queryKey: ["admin", "activity", page],
    queryFn: async () => {
      const { data } = await api.get("/api/v1/admin/activity", { params: { page, limit: 20 } });
      return data;
    },
  });

  const activities = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const getIcon = (action: string): keyof typeof Ionicons.glyphMap => {
    if (action.includes("login")) return "log-in-outline";
    if (action.includes("create") || action.includes("added")) return "add-circle-outline";
    if (action.includes("delete") || action.includes("removed")) return "trash-outline";
    if (action.includes("update") || action.includes("change")) return "create-outline";
    if (action.includes("approve")) return "checkmark-circle-outline";
    if (action.includes("reject")) return "close-circle-outline";
    return "ellipse-outline";
  };

  const renderActivity = ({ item }: { item: IActivity }) => (
    <Card style={styles.activityCard}>
      <View style={styles.activityRow}>
        <Ionicons name={getIcon(item.action)} size={20} color="#004030" style={{ marginRight: 12, marginTop: 2 }} />
        <View style={styles.activityContent}>
          <Text style={styles.actionText}>{item.action}</Text>
          <Text style={styles.detailsText}>{item.details}</Text>
          <View style={styles.activityMeta}>
            <Text style={styles.metaText}>{item.actorName}</Text>
            <Text style={styles.metaText}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Card>
  );

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  if (isLoading) return <Spinner message="Loading activity log..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item._id}
        renderItem={renderActivity}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No activity yet" message="Platform activity will appear here" />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footer}><Spinner size="sm" /></View> : null}
      />
    </View>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  activityCard: {
    marginBottom: 8,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityContent: {
    flex: 1,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  detailsText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  activityMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    opacity: 0.7,
  },
  footer: {
    paddingVertical: 16,
  },
});
