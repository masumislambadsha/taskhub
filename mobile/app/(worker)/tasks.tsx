import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ScrollView, RefreshControl, Alert, Image, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Card from "../../src/components/ui/Card";
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

export default function Tasks() {
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
    queryKey: ["worker-tasks", page, search, category],
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
          text: "Submit Work",
          onPress: () => Alert.alert("Submit Work", "Task submission will be available in a future update."),
        },
      ],
    );
  }, []);

  const renderTask = useCallback(
    ({ item }: { item: ITask }) => (
      <TouchableOpacity onPress={() => handleTaskPress(item)} activeOpacity={0.7}>
        <Card style={styles.card}>
          {item.imageUrl && (
            <View style={styles.imageWrapper}>
              <Image source={{ uri: item.imageUrl }} style={styles.taskImage} />
            </View>
          )}
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            {item.category && (
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{item.category}</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardBuyer}>by {item.buyerName}</Text>
          <View style={styles.cardMeta}>
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
            <Text style={styles.applyButtonText}>View & Apply</Text>
          </View>
        </Card>
      </TouchableOpacity>
    ),
    [handleTaskPress],
  );

  if (isLoading && !data) return <Spinner message="Loading tasks..." />;

  if (isError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load tasks</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchSection}>
        <Input placeholder="Search tasks..." value={search} onChangeText={handleSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}>
        <TouchableOpacity style={[styles.categoryChip, !category && styles.categoryChipActive]} onPress={() => handleCategory("")}>
          <Text style={[styles.categoryChipText, !category && styles.categoryChipTextActive]}>All</Text>
        </TouchableOpacity>
        {TASK_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => handleCategory(cat)}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={data?.tasks ?? []}
        keyExtractor={(item) => item._id}
        renderItem={renderTask}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        ListEmptyComponent={<EmptyState title="No tasks found" message="Try adjusting your search or filter" />}
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
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF9E5', padding: 24 },
  errorText: { fontSize: 16, color: 'rgba(0,64,48,0.6)', textAlign: 'center' },
  container: { flex: 1, backgroundColor: '#FFF9E5' },
  searchSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  categoryScroll: { maxHeight: 44, marginBottom: 8 },
  categoryChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,64,48,0.2)', backgroundColor: '#FFFFFF' },
  categoryChipActive: { backgroundColor: '#EFF6FF', borderColor: '#004030' },
  categoryChipText: { fontSize: 14, fontWeight: '600', color: 'rgba(0,64,48,0.6)' },
  categoryChipTextActive: { color: '#004030' },
  card: { marginBottom: 12, padding: 0, overflow: 'hidden' },
  imageWrapper: { width: '100%', height: 160 },
  taskImage: { width: '100%', height: '100%' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16, paddingTop: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#00281D', flex: 1, lineHeight: 22 },
  categoryBadge: { backgroundColor: 'rgba(74, 151, 130, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  categoryBadgeText: { fontSize: 11, fontWeight: '600', color: '#4A9782' },
  cardBuyer: { fontSize: 12, color: 'rgba(0, 64, 48, 0.5)', paddingHorizontal: 16, marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 12 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payoutText: { fontSize: 14, fontWeight: '700', color: '#4A9782' },
  slotsLeft: { fontSize: 12, color: 'rgba(0, 64, 48, 0.5)' },
  deadline: { fontSize: 10, color: 'rgba(0, 64, 48, 0.3)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, marginTop: 8 },
  applyButton: { marginTop: 12, marginHorizontal: 16, marginBottom: 16, backgroundColor: '#004030', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  applyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  loadMoreContainer: { paddingVertical: 16, alignItems: 'center' },
});
