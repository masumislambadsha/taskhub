import { useState, useCallback } from "react";
import {
  View, Text, FlatList, RefreshControl, TouchableOpacity, Modal,
  ScrollView, KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, PaginatedResponse } from "../../src/types";

const statusVariant: Record<string, "pending" | "approved" | "rejected" | "open" | "closed" | "active" | "suspended" | "default"> = {
  open: "open",
  closed: "closed",
  blocked: "rejected",
  archived: "default",
};

export default function Tasks() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("");
  const [requiredWorkers, setRequiredWorkers] = useState("");
  const [payableAmount, setPayableAmount] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [submissionInfo, setSubmissionInfo] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["buyer-tasks", page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ITask>>("/api/v1/tasks", { params: { page, limit: 20 } });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        details,
        category,
        requiredWorkers: parseInt(requiredWorkers, 10),
        payableAmount: parseFloat(payableAmount),
        completionDate,
        submissionInfo,
      };
      const { data } = await api.post<ITask>("/api/v1/tasks", payload);
      return data;
    },
    onSuccess: () => {
      setShowModal(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to create task");
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/api/v1/tasks/${id}`, { status: "closed" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] }),
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to close task"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/v1/tasks/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] }),
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to delete task"),
  });

  const resetForm = () => {
    setTitle("");
    setDetails("");
    setCategory("");
    setRequiredWorkers("");
    setPayableAmount("");
    setCompletionDate("");
    setSubmissionInfo("");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await refetch();
    setRefreshing(false);
  };

  const loadMore = () => {
    if (data && page < data.pages) setPage((p) => p + 1);
  };

  const handleLongPress = (task: ITask) => {
    Alert.alert(task.title, "Choose an action", [
      { text: "Edit", onPress: () => Alert.alert("Info", "Edit feature coming soon") },
      {
        text: "Close",
        onPress: () =>
          Alert.alert("Confirm", "Close this task?", [
            { text: "Cancel", style: "cancel" },
            { text: "Close", onPress: () => closeMutation.mutate(task._id) },
          ]),
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          Alert.alert("Confirm", "Delete this task? This cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(task._id) },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const renderTask = ({ item }: { item: ITask }) => (
    <TouchableOpacity onLongPress={() => handleLongPress(item)} activeOpacity={0.8}>
      <Card style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={1}>{item.title}</Text>
          <Badge label={item.status} variant={statusVariant[item.status] || "default"} />
        </View>
        {item.category && <Text style={styles.taskCategory}>{item.category}</Text>}
        <View style={styles.taskMeta}>
          <Text style={styles.taskMetaText}>{item.filledWorkers}/{item.requiredWorkers} workers</Text>
          <Text style={styles.taskMetaText}>${item.payableAmount?.toFixed(2)}</Text>
        </View>
        <Text style={styles.taskDeadline}>Deadline: {new Date(item.completionDate).toLocaleDateString()}</Text>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && !data) return <Spinner message="Loading tasks..." />;

  return (
    <View style={styles.container}>
      <View style={styles.headerActions}>
        <Button title="Create Task" onPress={() => setShowModal(true)} style={styles.createBtn} />
      </View>

      <FlatList
        data={data?.tasks || []}
        keyExtractor={(item) => item._id}
        renderItem={renderTask}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<EmptyState title="No tasks yet" message="Create your first task to get started" />}
        ListFooterComponent={page < (data?.pages || 1) ? <Spinner size="small" /> : null}
      />

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Task</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="close" size={28} color="#00281D" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Input label="Title" value={title} onChangeText={setTitle} placeholder="Enter task title" />
            <Input label="Details" value={details} onChangeText={setDetails} placeholder="Describe the task" multiline numberOfLines={3} />

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {TASK_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Input label="Required Workers" value={requiredWorkers} onChangeText={setRequiredWorkers} keyboardType="number-pad" placeholder="e.g. 10" />
            <Input label="Payout per Worker ($)" value={payableAmount} onChangeText={setPayableAmount} keyboardType="decimal-pad" placeholder="e.g. 0.50" />
            <Input label="Deadline" value={completionDate} onChangeText={setCompletionDate} placeholder="YYYY-MM-DD" />
            <Input label="Submission Info" value={submissionInfo} onChangeText={setSubmissionInfo} placeholder="What workers should submit" multiline numberOfLines={2} />

            <Button
              title="Publish Task"
              onPress={() => createMutation.mutate()}
              loading={createMutation.isPending}
              disabled={!title || !requiredWorkers || !payableAmount || !completionDate}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  headerActions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  createBtn: {
    alignSelf: 'flex-end',
  },
  taskCard: {
    marginBottom: 12,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  taskCategory: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  taskMetaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#004030',
  },
  taskDeadline: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,64,48,0.05)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#00281D',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00281D',
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.2)',
    backgroundColor: '#FFFFFF',
  },
  categoryChipActive: {
    borderColor: '#004030',
    backgroundColor: 'rgba(0,64,48,0.1)',
  },
  categoryChipText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  categoryChipTextActive: {
    color: '#004030',
    fontWeight: '600',
  },
});
