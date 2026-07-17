import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
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

  const { data, isLoading, refetch } = useQuery<ICategory[]>({
    queryKey: ["admin", "categories"],
    queryFn: async () => {
      const { data } = await api.get<ICategory[]>("/api/v1/admin/categories");
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

  const categories = Array.isArray(data) ? data : [];

  const renderCategory = ({ item }: { item: ICategory }) => (
    <Card style={styles.categoryCard}>
      <View style={styles.categoryRow}>
        <View style={styles.categoryInfo}>
          <Text style={styles.categoryName}>{item.name}</Text>
          <Text style={styles.taskCount}>{item.taskCount} tasks</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Alert.alert("Delete Category", `Delete "${item.name}"?`, [
              { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(item._id) },
              { text: "Cancel", style: "cancel" },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
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
        <View style={styles.staticCategoriesRow}>
          {TASK_CATEGORIES.map((cat) => (
            <View key={cat} style={styles.staticChip}>
              <Text style={styles.staticChipText}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={[styles.sectionTitle, styles.dynamicTitle]}>Dynamic Categories</Text>
      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        renderItem={renderCategory}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
        ListEmptyComponent={<Text style={styles.emptyText}>No custom categories added yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  addCard: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  categoryCard: {
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  taskCount: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  staticSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  dynamicTitle: {
    paddingHorizontal: 16,
  },
  staticCategoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  staticChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
  },
  staticChipText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(0,64,48,0.6)',
    marginTop: 24,
  },
});
