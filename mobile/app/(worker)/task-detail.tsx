import { useState, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, StyleSheet, Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import { getUserData } from "../../src/lib/storage";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";
import type { ITask } from "../../src/types";

export default function WorkerTaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [details, setDetails] = useState("");
  const [proofLinks, setProofLinks] = useState<string[]>([""]);

  const { data: task, isLoading } = useQuery({
    queryKey: ["worker-task", id],
    queryFn: async () => {
      const { data } = await api.get<ITask>(`/api/v1/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["worker-task", id] });
    setRefreshing(false);
  }, [id, queryClient]);

  function handleAddLink() {
    setProofLinks((prev) => [...prev, ""]);
  }

  function handleRemoveLink(index: number) {
    setProofLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLinkChange(text: string, index: number) {
    setProofLinks((prev) => {
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }

  async function handleSubmit() {
    if (!details) {
      Alert.alert("Error", "Please provide submission details");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        taskId: id,
        details,
        proofLinks: proofLinks.filter(Boolean),
      };

      const userStr = await getUserData();
      if (userStr) {
        const user = JSON.parse(userStr);
        payload.workerName = user.name;
      }

      await api.post("/api/v1/submissions", payload);
      Alert.alert("Success", "Submission sent! Waiting for buyer review.", [
        { text: "OK", onPress: () => router.push("/(worker)/submissions") },
      ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <Spinner message="Loading task..." />;
  if (!task) return (
    <View style={styles.center}>
      <Text style={styles.notFound}>Task not found</Text>
    </View>
  );

  const remaining = task.requiredWorkers - task.filledWorkers;
  const deadline = new Date(task.completionDate);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const timeLeft = diffDays > 0 ? `${diffDays} days` : "Expired";

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
      keyboardShouldPersistTaps="handled"
    >
      {/* Back */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#004030" />
      </TouchableOpacity>

      {/* Task Image */}
      {task.imageUrl && (
        <Card style={styles.imageCard}>
          <Image source={{ uri: task.imageUrl }} style={styles.taskImage} resizeMode="cover" />
        </Card>
      )}

      {/* Task Info */}
      <Card style={styles.infoCard}>
        <View style={styles.titleRow}>
          <Text style={styles.taskTitle}>{task.title}</Text>
          {task.category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{task.category}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Payout</Text>
            <View style={styles.payoutRow}>
              <Ionicons name="diamond" size={14} color="#F59E0B" />
              <Text style={styles.payoutValue}>{task.payableAmount}</Text>
            </View>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Slots Left</Text>
            <Text style={styles.statValue}>{remaining}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Deadline</Text>
            <Text style={styles.statDate}>{deadline.toLocaleDateString()}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Time Left</Text>
            <Text style={styles.statValue}>{timeLeft}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.descriptionText}>{task.details}</Text>

        {task.submissionInfo && (
          <>
            <Text style={styles.sectionTitle}>Submission Instructions</Text>
            <View style={styles.instructionsBox}>
              <Text style={styles.instructionsText}>{task.submissionInfo}</Text>
            </View>
          </>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.postedBy}>Posted by {task.buyerName}</Text>
        </View>
      </Card>

      {/* Submit Form */}
      {task.status === "open" && remaining > 0 ? (
        <Card style={styles.submitCard}>
          <Text style={styles.submitTitle}>Submit Your Work</Text>

          <Input
            label="Submission Details"
            value={details}
            onChangeText={setDetails}
            placeholder="Describe what you did…"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.fieldLabel}>Proof Links</Text>
          {proofLinks.map((link, i) => (
            <View key={i} style={styles.linkRow}>
              <Input
                value={link}
                onChangeText={(t) => handleLinkChange(t, i)}
                placeholder="https://..."
                autoCapitalize="none"
                style={{ flex: 1 }}
              />
              {proofLinks.length > 1 && (
                <TouchableOpacity onPress={() => handleRemoveLink(i)} style={styles.removeLink}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={handleAddLink} style={styles.addLink}>
            <Ionicons name="add-circle" size={18} color="#4A9782" />
            <Text style={styles.addLinkText}>Add another link</Text>
          </TouchableOpacity>

          <Button
            title="Submit Work"
            onPress={handleSubmit}
            loading={submitting}
            disabled={!details}
            style={{ marginTop: 8 }}
          />
        </Card>
      ) : (
        <Card style={styles.closedCard}>
          <Text style={styles.closedText}>
            This task is no longer accepting submissions.
          </Text>
        </Card>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF9E5" },
  notFound: { fontSize: 16, color: "rgba(0,64,48,0.4)" },
  backBtn: { padding: 16, paddingBottom: 8 },
  imageCard: { marginHorizontal: 16, marginBottom: 12, padding: 0, overflow: "hidden" },
  taskImage: { width: "100%", height: 200 },
  infoCard: { marginHorizontal: 16, marginBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 16 },
  taskTitle: { fontSize: 20, fontWeight: "700", color: "#00281D", flex: 1 },
  categoryBadge: { backgroundColor: "rgba(74,151,130,0.1)", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  categoryText: { fontSize: 11, fontWeight: "600", color: "#4A9782" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  statItem: { backgroundColor: "#FFF9E5", borderRadius: 8, padding: 10, width: "47%" },
  statLabel: { fontSize: 11, color: "rgba(0,64,48,0.5)", marginBottom: 4 },
  payoutRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  payoutValue: { fontSize: 16, fontWeight: "700", color: "#4A9782" },
  statValue: { fontSize: 16, fontWeight: "700", color: "#00281D" },
  statDate: { fontSize: 12, fontWeight: "600", color: "#00281D" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#00281D", marginTop: 12, marginBottom: 6 },
  descriptionText: { fontSize: 14, color: "rgba(0,64,48,0.7)", lineHeight: 20 },
  instructionsBox: { backgroundColor: "rgba(74,151,130,0.05)", borderWidth: 1, borderColor: "rgba(74,151,130,0.2)", borderRadius: 8, padding: 12 },
  instructionsText: { fontSize: 14, color: "rgba(0,64,48,0.7)", lineHeight: 20 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 16 },
  postedBy: { fontSize: 12, color: "rgba(0,64,48,0.4)" },
  submitCard: { marginHorizontal: 16, marginBottom: 12 },
  submitTitle: { fontSize: 18, fontWeight: "700", color: "#00281D", marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#00281D", marginBottom: 8 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  removeLink: { padding: 4 },
  addLink: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  addLinkText: { fontSize: 13, fontWeight: "600", color: "#4A9782" },
  closedCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#FEF3C7", borderColor: "#FDE68A" },
  closedText: { fontSize: 14, fontWeight: "600", color: "#92400E", textAlign: "center" },
});
