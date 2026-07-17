import { useState, useCallback, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, PaginatedResponse } from "../../src/types";

const STATUS_VARIANT: Record<string, "pending" | "approved" | "rejected" | "open" | "closed" | "active" | "suspended" | "default"> = {
  open: "open",
  closed: "closed",
  blocked: "rejected",
};

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
          <View style={styles.cardRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Badge label={item.status} variant={STATUS_VARIANT[item.status] || "default"} />
          </View>
          <Text style={styles.cardBuyer}>by {item.buyerName}</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardAmount}>{item.payableAmount} coins</Text>
            <Text style={styles.cardDue}>Due {new Date(item.completionDate).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.cardSlots}>{item.remainingWorkers} slot{item.remainingWorkers !== 1 ? "s" : ""} remaining</Text>
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
        data={data?.data ?? []}
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
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  categoryScroll: {
    maxHeight: 44,
    marginBottom: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.2)',
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#004030',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,64,48,0.6)',
  },
  categoryChipTextActive: {
    color: '#004030',
  },
  card: {
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  cardBuyer: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginBottom: 8,
  },
  cardInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00281D',
  },
  cardDue: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  cardSlots: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
