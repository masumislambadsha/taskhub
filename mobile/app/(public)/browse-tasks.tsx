import { useState, useCallback, useMemo } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, RefreshControl, Alert, Image,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

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
      const res = await api.get<PaginatedResponse<ITask, 'tasks'>>("/api/v1/tasks", { params: queryParams });
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
          {item.imageUrl && (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: item.imageUrl }} style={styles.taskImage} />
            </View>
          )}
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle} numberOfLines={2}>
              {item.title}
            </Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}
          </View>
          <Text style={styles.taskBuyer}>by {item.buyerName}</Text>
          <View style={styles.taskMeta}>
            <View style={styles.payoutRow}>
              <Ionicons name="cash-outline" size={14} color="#D4A017" />
              <Text style={styles.payoutText}>{item.payableAmount} coins</Text>
            </View>
            <Text style={styles.slotsLeft}>
              {item.requiredWorkers - item.filledWorkers} slots left
            </Text>
          </View>
          <Text style={styles.deadline}>
            Deadline: {formatDate(item.completionDate)}
          </Text>
          <View style={styles.applyButton}>
            <Text style={styles.applyButtonText}>Sign in to Apply</Text>
          </View>
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
        data={data?.tasks ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderTask}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
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
  container: { flex: 1, backgroundColor: '#FFF9E5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF9E5', padding: 24 },
  errorText: { fontSize: 16, color: '#004030', textAlign: 'center' },
  headerBar: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#00281D' },
  headerSubtitle: { fontSize: 14, color: '#004030', marginTop: 2 },
  searchContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  chipsScroll: { maxHeight: 44, marginBottom: 8 },
  chipsContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#004030', backgroundColor: '#FFFFFF' },
  chipActive: { borderColor: '#004030', backgroundColor: '#EFF6FF' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#004030' },
  chipTextActive: { color: '#004030' },
  list: { padding: 16, paddingTop: 4 },
  taskCard: { marginBottom: 12, padding: 0, overflow: 'hidden' },
  imageWrapper: { width: '100%', height: 160 },
  taskImage: { width: '100%', height: '100%' },
  taskHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  taskTitle: { fontSize: 16, fontWeight: '700', color: '#00281D', flex: 1, lineHeight: 22 },
  categoryBadge: { backgroundColor: 'rgba(74, 151, 130, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#4A9782' },
  taskBuyer: { fontSize: 12, color: 'rgba(0, 64, 48, 0.5)', paddingHorizontal: 16, marginTop: 2 },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 12 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payoutText: { fontSize: 14, fontWeight: '700', color: '#4A9782' },
  slotsLeft: { fontSize: 12, color: 'rgba(0, 64, 48, 0.5)' },
  deadline: { fontSize: 10, color: 'rgba(0, 64, 48, 0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 8 },
  applyButton: { marginTop: 12, marginHorizontal: 16, marginBottom: 16, backgroundColor: '#004030', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  loadMore: { paddingVertical: 16, alignItems: 'center' },
});
