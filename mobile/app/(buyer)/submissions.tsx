import { useState } from "react";
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { ISubmission, PaginatedResponse } from "../../src/types";

export default function Submissions() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["buyer-submissions", page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", { params: { page, limit: 20 } });
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/v1/submissions/${id}/status`, { status: "approved" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-submissions"] }),
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/v1/submissions/${id}/status`, { status: "rejected" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["buyer-submissions"] }),
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to reject"),
  });

  const handleSubmissionTap = (sub: ISubmission) => {
    if (sub.status !== "pending") return;
    Alert.alert(
      "Review Submission",
      `From: ${sub.workerName}\nTask: ${sub.taskTitle}\nPayout: $${sub.payableAmount?.toFixed(2)}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () =>
            Alert.alert("Confirm Reject", "Are you sure?", [
              { text: "Cancel", style: "cancel" },
              { text: "Reject", style: "destructive", onPress: () => rejectMutation.mutate(sub._id) },
            ]),
        },
        {
          text: "Approve",
          onPress: () =>
            Alert.alert("Confirm Approve", "Approve this submission?", [
              { text: "Cancel", style: "cancel" },
              { text: "Approve", onPress: () => approveMutation.mutate(sub._id) },
            ]),
        },
      ]
    );
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

  const renderSubmission = ({ item }: { item: ISubmission }) => (
    <TouchableOpacity onPress={() => handleSubmissionTap(item)} activeOpacity={item.status === "pending" ? 0.7 : 1}>
      <Card style={styles.submissionCard}>
        <View style={styles.submissionHeader}>
          <Text style={styles.workerName}>{item.workerName}</Text>
          <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
        </View>
        <Text style={styles.taskTitle}>{item.taskTitle}</Text>
        <View style={styles.submissionMeta}>
          <Text style={styles.metaDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          <Text style={styles.payout}>${item.payableAmount?.toFixed(2)}</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && !data) return <Spinner message="Loading submissions..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={data?.submissions || []}
        keyExtractor={(item) => item._id}
        renderItem={renderSubmission}
        contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<EmptyState title="No submissions yet" message="Submissions from workers will appear here" />}
        ListFooterComponent={page < (data?.pages || 1) ? <Spinner size="small" /> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  submissionCard: {
    marginBottom: 12,
  },
  submissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  taskTitle: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 6,
  },
  submissionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  payout: {
    fontSize: 16,
    fontWeight: '700',
    color: '#004030',
  },
});
