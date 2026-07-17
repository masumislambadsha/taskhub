import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";
import type { ITask } from "../../src/types";

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("");
  const [requiredWorkers, setRequiredWorkers] = useState("");
  const [payableAmount, setPayableAmount] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [submissionInfo, setSubmissionInfo] = useState("");

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-edit", id],
    queryFn: async () => {
      const { data } = await api.get<ITask>(`/api/v1/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDetails(task.details);
      setCategory(task.category || "");
      setRequiredWorkers(String(task.requiredWorkers));
      setPayableAmount(String(task.payableAmount));
      setCompletionDate(task.completionDate?.split("T")[0] || "");
      setSubmissionInfo(task.submissionInfo || "");
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.put(`/api/v1/tasks/${id}`, {
        title, details, category,
        requiredWorkers: parseInt(requiredWorkers, 10),
        payableAmount: parseFloat(payableAmount),
        completionDate, submissionInfo,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["buyer-task-detail", id] });
      Alert.alert("Success", "Task updated!", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to update task");
    },
  });

  if (isLoading) return <Spinner message="Loading task..." />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#004030" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Task</Text>
        </View>

        <Card style={styles.formCard}>
          <Input label="Task Title" value={title} onChangeText={setTitle} />
          <Input label="Description" value={details} onChangeText={setDetails} multiline numberOfLines={4} />
          <Input label="Submission Instructions" value={submissionInfo} onChangeText={setSubmissionInfo} multiline numberOfLines={3} />

          <Text style={styles.fieldLabel}>Category</Text>
          <View style={styles.categoryRow}>
            {TASK_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input label="Required Workers" value={requiredWorkers} onChangeText={setRequiredWorkers} keyboardType="number-pad" />
          <Input label="Payout per Worker" value={payableAmount} onChangeText={setPayableAmount} keyboardType="decimal-pad" />
          <Input label="Completion Deadline" value={completionDate} onChangeText={setCompletionDate} placeholder="YYYY-MM-DD" />

          <Button
            title="Save Changes"
            onPress={() => updateMutation.mutate()}
            loading={updateMutation.isPending}
            disabled={!title || !details || !requiredWorkers || !payableAmount || !completionDate}
            style={{ marginTop: 8 }}
          />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  scroll: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#004030" },
  formCard: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#00281D", marginBottom: 8 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: "rgba(0,64,48,0.2)", backgroundColor: "#FFF" },
  categoryChipActive: { borderColor: "#004030", backgroundColor: "rgba(0,64,48,0.1)" },
  categoryChipText: { fontSize: 14, color: "rgba(0,64,48,0.6)" },
  categoryChipTextActive: { color: "#004030", fontWeight: "600" },
});
