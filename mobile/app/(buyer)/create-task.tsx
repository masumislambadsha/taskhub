import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { TASK_CATEGORIES } from "../../src/lib/constants";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import type { ITask } from "../../src/types";

export default function CreateTask() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [category, setCategory] = useState("");
  const [requiredWorkers, setRequiredWorkers] = useState("1");
  const [payableAmount, setPayableAmount] = useState("10");
  const [completionDate, setCompletionDate] = useState("");
  const [submissionInfo, setSubmissionInfo] = useState("");

  const totalCost = parseInt(requiredWorkers || "0", 10) * parseFloat(payableAmount || "0");

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<ITask>("/api/v1/tasks", {
        title,
        details,
        category,
        requiredWorkers: parseInt(requiredWorkers, 10),
        payableAmount: parseFloat(payableAmount),
        completionDate,
        submissionInfo,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] });
      router.push(`/(buyer)/task-success?id=${data._id}`);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to create task");
    },
  });

  function handleSubmit() {
    if (!title || !details || !requiredWorkers || !payableAmount || !completionDate) {
      Alert.alert("Error", "Please fill in all required fields");
      return;
    }
    createMutation.mutate();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#004030" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Post New Task</Text>
          </View>
        </View>

        <Card style={styles.formCard}>
          <Input label="Task Title" value={title} onChangeText={setTitle} placeholder="e.g. Watch my YouTube video and comment" />
          <Input label="Description" value={details} onChangeText={setDetails} placeholder="Describe the task in detail…" multiline numberOfLines={4} />
          <Input label="Submission Instructions" value={submissionInfo} onChangeText={setSubmissionInfo} placeholder="What should workers submit as proof?" multiline numberOfLines={3} />

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

          <Input label="Required Workers" value={requiredWorkers} onChangeText={setRequiredWorkers} keyboardType="number-pad" placeholder="e.g. 10" />
          <Input label="Payout per Worker (coins)" value={payableAmount} onChangeText={setPayableAmount} keyboardType="decimal-pad" placeholder="e.g. 10" />
          <Input label="Completion Deadline" value={completionDate} onChangeText={setCompletionDate} placeholder="YYYY-MM-DD" />

          <View style={[styles.costBox, totalCost > 0 && styles.costBoxVisible]}>
            <Text style={styles.costLabel}>Total Cost</Text>
            <Text style={styles.costValue}>{totalCost} coins</Text>
          </View>

          <Button
            title={totalCost > 0 ? `Post Task (${totalCost} coins)` : "Post Task"}
            onPress={handleSubmit}
            loading={createMutation.isPending}
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
  costBox: { borderRadius: 8, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  costBoxVisible: { backgroundColor: "rgba(74,151,130,0.08)", borderWidth: 1, borderColor: "rgba(74,151,130,0.2)" },
  costLabel: { fontSize: 14, fontWeight: "600", color: "#004030" },
  costValue: { fontSize: 18, fontWeight: "700", color: "#4A9782" },
});
