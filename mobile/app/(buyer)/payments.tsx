import { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { IPayment, PaginatedResponse } from "../../src/types";

export default function Payments() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["buyer-payments"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IPayment>>("/api/v1/payments/history", { params: { page: 1, limit: 50 } });
      return data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <Spinner message="Loading payments..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load payments</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  const payments = data?.data || [];

  const renderPayment = ({ item }: { item: IPayment }) => (
    <Card style={styles.paymentCard}>
      <View style={styles.paymentRow}>
        <View>
          <Text style={styles.paymentCoins}>{item.coinsPurchased} coins</Text>
          <Text style={styles.paymentMeta}>{item.gateway.toUpperCase()} · ${item.amount.toFixed(2)}</Text>
          <Text style={styles.paymentDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          {item.gatewayTransactionId && (
            <Text style={styles.txId}>TX: {item.gatewayTransactionId}</Text>
          )}
        </View>
        <Badge
          label={item.status}
          variant={item.status === "success" ? "approved" : item.status === "failed" ? "rejected" : "pending"}
        />
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item._id}
        renderItem={renderPayment}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState title="No payments yet" message="Your payment history will appear here" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  list: { padding: 16, paddingTop: 16, paddingBottom: 32 },
  paymentCard: { marginBottom: 10 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentCoins: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  paymentMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  paymentDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  txId: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, opacity: 0.7 },
});
