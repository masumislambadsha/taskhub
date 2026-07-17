import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import { ITask, PaginatedResponse } from "../../src/types";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

const statusBadgeVariant: Record<string, "open" | "closed" | "rejected" | "default"> = {
  open: "open",
  closed: "closed",
  blocked: "rejected",
  archived: "default",
};

export default function AdminTasks() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<PaginatedResponse<ITask>>({
    queryKey: ["admin", "tasks", page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ITask>>("/api/v1/admin/tasks", { params: { page, limit: 20 } });
      return data;
    },
  });

  const tasks = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const blockTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.put(`/api/v1/admin/tasks/${taskId}`, { status: "blocked" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tasks"] });
      Alert.alert("Success", "Task has been blocked");
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to block task");
    },
  });

  const handleTaskPress = useCallback(
    (task: ITask) => {
      Alert.alert(
        task.title,
        `Buyer: ${task.buyerName}\nStatus: ${task.status}\nPayout: $${task.payableAmount}\nWorkers: ${task.filledWorkers}/${task.requiredWorkers}\nCreated: ${new Date(task.createdAt).toLocaleDateString()}`,
        [
          {
            text: "Block Task",
            style: "destructive",
            onPress: () => {
              Alert.alert("Confirm Block", `Block "${task.title}"?`, [
                { text: "Block", style: "destructive", onPress: () => blockTaskMutation.mutate(task._id) },
                { text: "Cancel", style: "cancel" },
              ]);
            },
          },
          {
            text: "View Details",
            onPress: () => {
              Alert.alert(
                task.title,
                `Description: ${task.details}\n\nCategory: ${task.category || "N/A"}\nBuyer: ${task.buyerName} (${task.buyerEmail})\nRequired: ${task.requiredWorkers}\nFilled: ${task.filledWorkers}\nPayable: $${task.payableAmount}\nDeadline: ${new Date(task.completionDate).toLocaleDateString()}\nStatus: ${task.status}\nCreated: ${new Date(task.createdAt).toLocaleDateString()}`,
              );
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    },
    [blockTaskMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: ITask }) => (
      <TouchableOpacity onPress={() => handleTaskPress(item)} activeOpacity={0.7}>
        <Card style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
            <Badge label={item.status} variant={statusBadgeVariant[item.status] ?? "default"} />
          </View>
          <Text style={styles.buyerName}>Buyer: {item.buyerName}</Text>
          <View style={styles.taskFooter}>
            <Text style={styles.workerCount}>Workers: {item.filledWorkers}/{item.requiredWorkers}</Text>
            <Text style={styles.payout}>${item.payableAmount}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    ),
    [handleTaskPress],
  );

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  if (isLoading) return <Spinner message="Loading tasks..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No tasks found" message="There are no tasks to manage yet" />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footerLoader}><Spinner size="small" /></View> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, paddingBottom: 32 },
  taskCard: { marginBottom: 12 },
  taskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  taskTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text, flex: 1, marginRight: 8 },
  buyerName: { fontSize: 13, color: COLORS.textSecondary, marginTop: 6 },
  taskFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  workerCount: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  payout: { fontSize: 14, fontWeight: "700", color: COLORS.success },
  footerLoader: { paddingVertical: 16 },
});
