import { useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl, Alert, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { IWithdrawal, PaginatedResponse } from "../../src/types";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

type FilterTab = "all" | "pending" | "approved" | "rejected";
const FILTER_TABS: FilterTab[] = ["all", "pending", "approved", "rejected"];

export default function AdminWithdrawals() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("pending");
  const [page, setPage] = useState(1);

  const statusParam = filter === "all" ? undefined : filter;

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<PaginatedResponse<IWithdrawal>>({
    queryKey: ["admin", "withdrawals", page, filter],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IWithdrawal>>("/api/v1/withdrawals", { params: { page, limit: 20, status: statusParam } });
      return data;
    },
  });

  const withdrawals = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/v1/withdrawals/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      Alert.alert("Success", "Withdrawal has been approved");
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/v1/withdrawals/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
      Alert.alert("Success", "Withdrawal has been rejected");
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.error || "Failed to reject"),
  });

  const handleWithdrawalPress = useCallback(
    (w: IWithdrawal) => {
      if (w.status !== "pending") {
        Alert.alert("Withdrawal Details", `Worker: ${w.workerName}\nCoins: ${w.coinRequested}\nAmount: $${w.amount.toFixed(2)}\nAccount: ${w.paymentSystem} - ${w.accountNumber}\nStatus: ${w.status}\nDate: ${new Date(w.createdAt).toLocaleDateString()}`);
        return;
      }

      Alert.alert(
        "Pending Withdrawal",
        `Worker: ${w.workerName}\nCoins: ${w.coinRequested}\nAmount: $${w.amount.toFixed(2)}\nAccount: ${w.paymentSystem} - ${w.accountNumber}\nDate: ${new Date(w.createdAt).toLocaleDateString()}`,
        [
          {
            text: "Approve",
            onPress: () => {
              Alert.alert("Confirm Approval", `Approve withdrawal of $${w.amount.toFixed(2)} for ${w.workerName}?`, [
                { text: "Approve", onPress: () => approveMutation.mutate(w._id) },
                { text: "Cancel", style: "cancel" },
              ]);
            },
          },
          {
            text: "Reject",
            style: "destructive",
            onPress: () => {
              Alert.alert("Confirm Rejection", `Reject withdrawal of $${w.amount.toFixed(2)} for ${w.workerName}?`, [
                { text: "Reject", style: "destructive", onPress: () => rejectMutation.mutate(w._id) },
                { text: "Cancel", style: "cancel" },
              ]);
            },
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    },
    [approveMutation, rejectMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: IWithdrawal }) => (
      <TouchableOpacity onPress={() => handleWithdrawalPress(item)} activeOpacity={0.7}>
        <Card style={styles.withdrawalCard}>
          <View style={styles.withdrawalHeader}>
            <Text style={styles.workerName}>{item.workerName}</Text>
            <Badge label={item.status} variant={item.status as "pending" | "approved" | "rejected"} />
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.coinsText}>{item.coinRequested} coins</Text>
            <Text style={styles.usdText}>${item.amount.toFixed(2)}</Text>
          </View>
          <Text style={styles.accountInfo}>{item.paymentSystem} · {item.accountNumber}</Text>
          <Text style={styles.dateInfo}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </Card>
      </TouchableOpacity>
    ),
    [handleWithdrawalPress],
  );

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  if (isLoading) return <Spinner message="Loading withdrawals..." />;

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, filter === tab && styles.filterTabActive]}
            onPress={() => { setFilter(tab); setPage(1); }}
          >
            <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={withdrawals}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title={`No ${filter === "all" ? "" : filter} withdrawals`} message={filter === "pending" ? "No pending withdrawal requests" : `No ${filter} withdrawals found`} />}
        ListFooterComponent={isFetching && page > 1 ? <View style={styles.footer}><Spinner size="small" /></View> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
  },
  filterTabActive: {
    backgroundColor: '#004030',
    borderColor: '#004030',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0,64,48,0.6)',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  withdrawalCard: {
    marginBottom: 12,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  coinsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#004030',
  },
  usdText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  accountInfo: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 6,
  },
  dateInfo: {
    fontSize: 11,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 6,
  },
  footer: {
    paddingVertical: 16,
  },
});
