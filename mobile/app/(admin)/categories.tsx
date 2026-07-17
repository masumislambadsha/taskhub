import { useState, useCallback } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { COLORS, TASK_CATEGORIES } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";
import Spinner from "../../src/components/ui/Spinner";

interface ICategory {
  _id: string;
  name: string;
  taskCount: number;
  createdAt: string;
}

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [newCategory, setNewCategory] = useState("");

  const { data, isLoading, refetch } = useQuery<{ data: ICategory[] }>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get<{ data: ICategory[] }>("/api/v1/admin/categories");
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      await api.post("/api/v1/admin/categories", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      setNewCategory("");
      Alert.alert("Success", "Category added");
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to add category"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/admin/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "categories"] });
      Alert.alert("Success", "Category deleted");
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to delete"),
  });

  const categories = data?.data ?? [];

  const renderCategory = ({ item }: { item: ICategory }) => (
    <Card style={styles.catCard}>
      <View style={styles.catRow}>
        <View style={styles.catInfo}>
          <Text style={styles.catName}>{item.name}</Text>
          <Text style={styles.catCount}>{item.taskCount} tasks</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Delete Category", `Delete "${item.name}"?`, [
              { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item._id) },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  if (isLoading) return <Spinner message="Loading categories..." />;

  return (
    <View style={styles.container}>
      <Card style={styles.addCard}>
        <Input
          placeholder="New category name"
          value={newCategory}
          onChangeText={setNewCategory}
        />
        <Button
          title="Add Category"
          onPress={() => {
            if (newCategory.trim()) addMutation.mutate(newCategory.trim());
          }}
          disabled={!newCategory.trim()}
          loading={addMutation.isPending}
        />
      </Card>

      <View style={styles.staticSection}>
        <Text style={styles.sectionTitle}>Static Categories</Text>
        <View style={styles.staticRow}>
          {TASK_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.staticChip}>
              <Text style={styles.staticChipText}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Dynamic Categories</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        renderItem={renderCategory}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No custom categories added yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  addCard: { margin: 16, marginBottom: 8 },
  staticSection: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12, paddingHorizontal: 16 },
  staticRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  staticChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: "#0040300D" },
  staticChipText: { fontSize: 13, color: COLORS.textSecondary },
  list: { padding: 16, paddingTop: 4, paddingBottom: 32 },
  catCard: { marginBottom: 8 },
  catRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catInfo: { flex: 1 },
  catName: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  catCount: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  emptyText: { textAlign: "center", color: COLORS.textSecondary, marginTop: 24 },
});
