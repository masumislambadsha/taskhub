import { useState, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, StyleSheet, Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ITask, ISubmission } from "../../src/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export default function BuyerTaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: task, isLoading } = useQuery({
    queryKey: ["buyer-task-detail", id],
    queryFn: async () => {
      const { data } = await api.get<ITask>(`/api/v1/tasks/${id}`);
      return data;
    },
    enabled: !!id,
  });

  const { data: submissionsData, refetch: refetchSubs } = useQuery({
    queryKey: ["buyer-task-submissions", id],
    queryFn: async () => {
      const { data } = await api.get<{ data: ISubmission[] }>(`/api/v1/submissions`, { params: { taskId: id, limit: 20 } });
      return data;
    },
    enabled: !!id,
  });

  const submissions = submissionsData?.data || [];

  const closeMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/v1/tasks/${id}`, { status: "closed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buyer-task-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["buyer-tasks"] });
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to close task"),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["buyer-task-detail", id] });
    await refetchSubs();
    setRefreshing(false);
  }, [id, queryClient, refetchSubs]);

  const handleClose = () => {
    Alert.alert("Close Task", "Are you sure you want to close this task?", [
      { text: "Cancel", style: "cancel" },
      { text: "Close", onPress: () => closeMutation.mutate() },
    ]);
  };

  if (isLoading) return <Spinner message="Loading task..." />;
  if (!task) return <EmptyState title="Task not found" message="This task could not be loaded." />;

  const remaining = task.requiredWorkers - task.filledWorkers;
  const totalSubs = submissions.filter((s) => s.taskId === task._id).length;
  const pendingSubs = submissions.filter((s) => s.status === "pending").length;
  const approvedSubs = submissions.filter((s) => s.status === "approved").length;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#004030" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerRow}>
            <Badge label={task.status} variant={task.status as any} />
          </View>
          <Text style={styles.taskTitle}>{task.title}</Text>
          <Text style={styles.taskDate}>
            Posted {formatDate(task.createdAt)} · Deadline {formatDate(task.completionDate)}
          </Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push(`/(buyer)/edit-task?id=${id}`)}>
          <Ionicons name="create-outline" size={18} color="#004030" />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="document-text" size={18} color="#4A9782" />
          <Text style={styles.statValue}>{totalSubs}</Text>
          <Text style={styles.statLabel}>Total Submissions</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time" size={18} color="#4A9782" />
          <Text style={styles.statValue}>{pendingSubs}</Text>
          <Text style={styles.statLabel}>Pending Review</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={18} color="#4A9782" />
          <Text style={styles.statValue}>{approvedSubs}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statCard, styles.statCardAccent]}>
          <Ionicons name="people" size={18} color="#4A9782" />
          <Text style={[styles.statValue, { color: "#FFF" }]}>{remaining}</Text>
          <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.6)" }]}>Slots Remaining</Text>
        </View>
      </View>

      {/* Task Image */}
      {task.imageUrl && (
        <Card style={styles.imageCard}>
          <Image source={{ uri: task.imageUrl }} style={styles.taskImage} resizeMode="cover" />
        </Card>
      )}

      {/* Task Details */}
      <Card style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Task Details</Text>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Category</Text>
          <Text style={styles.detailValue}>{task.category || "General"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Payout per Worker</Text>
          <Text style={styles.detailValue}>{task.payableAmount} coins</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Required Workers</Text>
          <Text style={styles.detailValue}>{task.requiredWorkers}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Filled Workers</Text>
          <Text style={styles.detailValue}>{task.filledWorkers}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Deadline</Text>
          <Text style={styles.detailValue}>{formatDate(task.completionDate)}</Text>
        </View>
      </Card>

      {/* Description */}
      <Card style={styles.detailsCard}>
        <Text style={styles.detailsTitle}>Description</Text>
        <Text style={styles.descriptionText}>{task.details}</Text>
      </Card>

      {/* Submission Instructions */}
      {task.submissionInfo && (
        <Card style={styles.instructionsCard}>
          <Text style={styles.detailsTitle}>Submission Instructions</Text>
          <Text style={styles.descriptionText}>{task.submissionInfo}</Text>
        </Card>
      )}

      {/* Submissions */}
      <Card style={styles.submissionsCard}>
        <View style={styles.submissionsHeader}>
          <Text style={styles.detailsTitle}>Submissions</Text>
          <TouchableOpacity onPress={() => router.push("/(buyer)/submissions")}>
            <Text style={styles.reviewAllLink}>Review all</Text>
          </TouchableOpacity>
        </View>
        {submissions.length === 0 ? (
          <Text style={styles.emptySubs}>No submissions yet. Workers will start submitting soon.</Text>
        ) : (
          submissions.slice(0, 10).map((s) => (
            <View key={s._id} style={styles.submissionRow}>
              <View style={styles.submissionInfo}>
                <Text style={styles.submissionWorker}>{s.workerName}</Text>
                <Text style={styles.submissionDetail} numberOfLines={1}>{s.details?.slice(0, 60)}...</Text>
                <Text style={styles.submissionDate}>{formatDate(s.createdAt)}</Text>
              </View>
              <Badge label={s.status} variant={s.status as any} />
            </View>
          ))
        )}
      </Card>

      {/* Close Task */}
      {task.status === "open" && (
        <View style={styles.closeSection}>
          <Button title="Close Task" variant="outline" onPress={handleClose} loading={closeMutation.isPending} />
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  header: { padding: 16, paddingBottom: 8 },
  backBtn: { marginBottom: 8 },
  headerInfo: {},
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  taskTitle: { fontSize: 22, fontWeight: "700", color: "#00281D" },
  taskDate: { fontSize: 12, color: "rgba(0,64,48,0.5)", marginTop: 4 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 8, backgroundColor: "#FFF", borderWidth: 1, borderColor: "rgba(0,64,48,0.1)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 13, fontWeight: "600", color: "#004030" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard: { backgroundColor: "#FFF", borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,64,48,0.05)", padding: 12, width: "47%", gap: 4 },
  statCardAccent: { backgroundColor: "#004030", borderColor: "#004030" },
  statValue: { fontSize: 22, fontWeight: "700", color: "#00281D" },
  statLabel: { fontSize: 11, color: "rgba(0,64,48,0.5)" },
  imageCard: { marginHorizontal: 16, marginBottom: 12, padding: 0, overflow: "hidden" },
  taskImage: { width: "100%", height: 180 },
  detailsCard: { marginHorizontal: 16, marginBottom: 12 },
  detailsTitle: { fontSize: 16, fontWeight: "700", color: "#00281D", marginBottom: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "rgba(0,64,48,0.05)" },
  detailLabel: { fontSize: 14, color: "rgba(0,64,48,0.5)" },
  detailValue: { fontSize: 14, fontWeight: "600", color: "#00281D" },
  descriptionText: { fontSize: 14, color: "rgba(0,64,48,0.6)", lineHeight: 20 },
  instructionsCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(74,151,130,0.05)", borderColor: "rgba(74,151,130,0.2)" },
  submissionsCard: { marginHorizontal: 16, marginBottom: 12 },
  submissionsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewAllLink: { fontSize: 12, color: "#4A9782", fontWeight: "600" },
  emptySubs: { fontSize: 14, color: "rgba(0,64,48,0.4)", textAlign: "center", paddingVertical: 20 },
  submissionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,64,48,0.05)" },
  submissionInfo: { flex: 1, marginRight: 12 },
  submissionWorker: { fontSize: 14, fontWeight: "600", color: "#00281D" },
  submissionDetail: { fontSize: 12, color: "rgba(0,64,48,0.4)", marginTop: 2 },
  submissionDate: { fontSize: 11, color: "rgba(0,64,48,0.3)", marginTop: 2 },
  closeSection: { paddingHorizontal: 16, marginTop: 8 },
});
