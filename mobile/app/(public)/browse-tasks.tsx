import { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl, Alert,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS, TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, PaginatedResponse } from "../../src/types";

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger"> = {
  open: "success",
  closed: "warning",
  blocked: "danger",
};

export default function BrowseTasks() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit: 20 };
    if (search.trim()) params.search = search.trim();
    if (category) params.category = category;
    return params;
  }, [page, search, category]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-tasks", page, search, category],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<ITask>>("/api/v1/tasks", { params: queryParams });
      return res.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleSearch = useCallback((text: string) => {
    setSearch(text);
    setPage(1);
  }, []);

  const handleCategory = useCallback((cat: string) => {
    setCategory((prev) => (prev === cat ? "" : cat));
    setPage(1);
  }, []);

  const handleTaskPress = useCallback((task: ITask) => {
    Alert.alert(
      task.title,
      `Buyer: ${task.buyerName}\nPayout: ${task.payableAmount} coins\nDeadline: ${new Date(task.completionDate).toLocaleDateString()}\nRemaining: ${task.remainingWorkers} slots\n\n${task.details}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign in to Apply",
          onPress: () => router.push("/(auth)/login"),
        },
      ],
    );
  }, []);

  const renderTask = useCallback(
    ({ item }: { item: ITask }) => (
      <TouchableOpacity onPress={() => handleTaskPress(item)} activeOpacity={0.7}>
        <Card style={styles.taskCard}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Badge label={item.status} variant={STATUS_VARIANT[item.status] || "default"} />
          </View>
          <Text style={styles.taskBuyer}>by {item.buyerName}</Text>
          <View style={styles.taskMeta}>
            <View style={styles.payoutRow}>
              <Ionicons name="wallet-outline" size={14} color={COLORS.primary} />
              <Text style={styles.payoutText}>{item.payableAmount} coins</Text>
            </View>
            <Text style={styles.deadline}>Due {new Date(item.completionDate).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.remaining}>
            {item.remainingWorkers} slot{item.remainingWorkers !== 1 ? "s" : ""} remaining
          </Text>
        </Card>
      </TouchableOpacity>
    ),
    [handleTaskPress],
  );

  if (isLoading && !data) return <Spinner message="Loading tasks..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load tasks</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Browse Tasks</Text>
        <Text style={styles.headerSubtitle}>Find tasks that match your skills</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input placeholder="Search tasks..." value={search} onChangeText={handleSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chipsContent}>
        <TouchableOpacity style={[styles.chip, !category && styles.chipActive]} onPress={() => handleCategory("")}>
          <Text style={[styles.chipText, !category && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {TASK_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => handleCategory(cat)}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState title="No tasks found" message="Try adjusting your search or filter" />}
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
  headerBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  chipsScroll: { maxHeight: 44, marginBottom: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.primary, backgroundColor: "#EFF6FF" },
  chipText: { fontSize: 13, fontWeight: "600", color: COLORS.textSecondary },
  chipTextActive: { color: COLORS.primary },
  list: { padding: 16, paddingTop: 4 },
  taskCard: { marginBottom: 12 },
  taskHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  taskTitle: { fontSize: 16, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: 8 },
  taskBuyer: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },
  taskMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  payoutRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  payoutText: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  deadline: { fontSize: 13, color: COLORS.textSecondary },
  remaining: { fontSize: 12, color: COLORS.textSecondary },
  loadMore: { paddingVertical: 16, alignItems: "center" },
});
