import { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
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
        <Ionicons name={getIcon(item.action)} size={20} color={COLORS.primary} style={styles.activityIcon} />
        <View style={styles.activityContent}>
          <Text style={styles.activityAction}>{item.action}</Text>
          <Text style={styles.activityDetails}>{item.details}</Text>
          <View style={styles.activityMeta}>
            <Text style={styles.activityActor}>{item.actorName}</Text>
            <Text style={styles.activityTime}>{formatTime(item.createdAt)}</Text>
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
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No activity yet" message="Platform activity will appear here" />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footerLoader}><Spinner size="small" /></View> : null}
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
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, paddingBottom: 32 },
  activityCard: { marginBottom: 8 },
  activityRow: { flexDirection: "row", alignItems: "flex-start" },
  activityIcon: { marginRight: 12, marginTop: 2 },
  activityContent: { flex: 1 },
  activityAction: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  activityDetails: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  activityMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  activityActor: { fontSize: 12, color: COLORS.textSecondary, opacity: 0.7 },
  activityTime: { fontSize: 12, color: COLORS.textSecondary, opacity: 0.7 },
  footerLoader: { paddingVertical: 16 },
});
