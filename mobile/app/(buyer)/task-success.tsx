import { useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import type { ITask } from "../../src/types";

export default function TaskSuccess() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: task, isLoading } = useQuery({
    queryKey: ["task-success", id],
    queryFn: async () => {
      const { data } = await api.get<ITask>(`/api/v1/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const handleCopyLink = useCallback(async () => {
    const url = `http://localhost:3000/buyer/tasks/${id}`;
    await Clipboard.setStringAsync(url);
    Alert.alert("Copied", "Task link copied to clipboard");
  }, [id]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={styles.successSection}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark-circle" size={48} color="#FFF" />
        </View>
        <Text style={styles.successTitle}>Your task is live!</Text>
        <Text style={styles.successDesc}>
          Workers have been notified. You&apos;ve successfully posted a new opportunity on TaskHub.
        </Text>
      </View>

      {/* Task Info */}
      <Card style={styles.taskInfoCard}>
        <Text style={styles.sectionLabel}>TASK IDENTIFICATION</Text>
        <Text style={styles.taskTitlePreview}>{task?.title ?? "—"}</Text>
        <View style={styles.taskInfoRow}>
          <View>
            <Text style={styles.taskInfoLabel}>Status</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active & Visible</Text>
            </View>
          </View>
          <View>
            <Text style={styles.taskInfoLabel}>Category</Text>
            <Text style={styles.taskInfoValue}>{task?.category || "General"}</Text>
          </View>
        </View>
      </Card>

      {/* Budget */}
      <Card style={styles.budgetCard}>
        <Text style={styles.budgetLabel}>PROJECT BUDGET</Text>
        <View style={styles.budgetRow}>
          <Text style={styles.budgetAmount}>{task?.payableAmount ?? "—"}</Text>
          <Text style={styles.budgetUnit}>coins / worker</Text>
        </View>
        <View style={styles.budgetDivider} />
        <View style={styles.budgetWorkersRow}>
          <Text style={styles.budgetWorkersLabel}>Desired Workers</Text>
          <Text style={styles.budgetWorkersValue}>{String(task?.requiredWorkers ?? "—").padStart(2, "0")}</Text>
        </View>
      </Card>

      {/* Next Steps */}
      <Card style={styles.stepsCard}>
        <Text style={styles.detailsTitle}>Next Milestones</Text>
        <View style={styles.stepRow}>
          <View style={styles.stepIcon}>
            <Ionicons name="people" size={20} color="#4A9782" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Review Submissions</Text>
            <Text style={styles.stepDesc}>Workers will start submitting soon. Review them from your submissions page.</Text>
          </View>
        </View>
        <View style={styles.stepRow}>
          <View style={[styles.stepIcon, { backgroundColor: "rgba(0,64,48,0.05)" }]}>
            <Ionicons name="star" size={20} color="#4A9782" />
          </View>
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Approve or Reject</Text>
            <Text style={styles.stepDesc}>Approve quality work to release coins, or reject with a reason.</Text>
          </View>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button title="View Live Task" onPress={() => router.push(`/(buyer)/task-detail?id=${id}`)} style={styles.actionBtn} />
        <Button title="Create Another Task" variant="outline" onPress={() => router.push("/(buyer)/create-task")} style={styles.actionBtn} />
        <TouchableOpacity style={styles.copyLink} onPress={handleCopyLink}>
          <Ionicons name="share-outline" size={18} color="#4A9782" />
          <Text style={styles.copyLinkText}>Copy Task Link</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  scroll: { padding: 16 },
  successSection: { alignItems: "center", paddingVertical: 24 },
  checkCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#4A9782", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  successTitle: { fontSize: 26, fontWeight: "800", color: "#00281D", textAlign: "center" },
  successDesc: { fontSize: 14, color: "rgba(0,64,48,0.6)", textAlign: "center", lineHeight: 20, marginTop: 8, maxWidth: 280 },
  taskInfoCard: { marginBottom: 12 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#4A9782", marginBottom: 12 },
  taskTitlePreview: { fontSize: 20, fontWeight: "700", color: "#00281D", marginBottom: 16 },
  taskInfoRow: { flexDirection: "row", gap: 40 },
  taskInfoLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "rgba(0,64,48,0.4)", marginBottom: 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4A9782" },
  statusText: { fontSize: 14, fontWeight: "600", color: "#4A9782" },
  taskInfoValue: { fontSize: 14, fontWeight: "600", color: "#00281D" },
  budgetCard: { marginBottom: 12, backgroundColor: "#004030" },
  budgetLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "rgba(255,255,255,0.5)", marginBottom: 8 },
  budgetRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  budgetAmount: { fontSize: 32, fontWeight: "800", color: "#FFF" },
  budgetUnit: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  budgetDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 12 },
  budgetWorkersRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  budgetWorkersLabel: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.7)" },
  budgetWorkersValue: { fontSize: 18, fontWeight: "700", color: "#FFF" },
  stepsCard: { marginBottom: 12 },
  detailsTitle: { fontSize: 16, fontWeight: "700", color: "#00281D", marginBottom: 16 },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(74,151,130,0.1)", alignItems: "center", justifyContent: "center" },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: "700", color: "#00281D" },
  stepDesc: { fontSize: 12, color: "rgba(0,64,48,0.5)", marginTop: 2, lineHeight: 16 },
  actions: { gap: 10, marginTop: 8 },
  actionBtn: { width: "100%" },
  copyLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  copyLinkText: { fontSize: 14, fontWeight: "600", color: "#4A9782" },
});
