import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { IPayment } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Payments() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["buyer-payments"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IPayment, 'payments'>>("/api/v1/payments/history", { params: { page: 1, limit: 50 } });
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
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Failed to load payments</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  const payments = data?.payments || [];

  const renderPayment = ({ item }: { item: IPayment }) => (
    <Card style={styles.paymentCard}>
      <View style={styles.paymentRow}>
        <View>
          <Text style={styles.coinsText}>{item.coinsPurchased} coins</Text>
          <Text style={styles.metaText}>{item.gateway.toUpperCase()} · ${item.amount.toFixed(2)}</Text>
          <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          {item.gatewayTransactionId && (
            <Text style={styles.txText}>TX: {item.gatewayTransactionId}</Text>
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
        contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        ListEmptyComponent={<EmptyState title="No payments yet" message="Your payment history will appear here" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9E5',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
  },
  paymentCard: {
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coinsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  metaText: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  dateText: {
    fontSize: 11,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  txText: {
    fontSize: 10,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
    opacity: 0.7,
  },
});
