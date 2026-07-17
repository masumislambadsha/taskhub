import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

interface IPayment {
  _id: string;
  userEmail: string;
  gateway: string;
  coinsPurchased: number;
  amount: number;
  status: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export default function AdminPayments() {
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<PaginatedResponse<IPayment>>({
    queryKey: ["admin", "payments", page],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IPayment>>("/api/v1/admin/payments", { params: { page, limit: 20 } });
      return data;
    },
  });

  const payments = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const renderPayment = ({ item }: { item: IPayment }) => (
    <Card style={styles.paymentCard}>
      <View style={styles.paymentHeader}>
        <Text style={styles.userEmail}>{item.userEmail}</Text>
        <Badge
          label={item.status}
          variant={item.status === "success" ? "approved" : item.status === "failed" ? "rejected" : "pending"}
        />
      </View>
      <View style={styles.amountRow}>
        <Text style={styles.coinsText}>{item.coinsPurchased} coins</Text>
        <Text style={styles.usdText}>${item.amount.toFixed(2)}</Text>
      </View>
      <Text style={styles.gatewayInfo}>{item.gateway.toUpperCase()} · {new Date(item.createdAt).toLocaleDateString()}</Text>
    </Card>
  );

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  if (isLoading) return <Spinner message="Loading payments..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={payments}
        keyExtractor={(item) => item._id}
        renderItem={renderPayment}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No payments found" message="Payment records will appear here" />}
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
  paymentCard: {
    marginBottom: 12,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userEmail: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: '700',
    color: '#004030',
  },
  usdText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
  },
  gatewayInfo: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 6,
  },
  footer: {
    paddingVertical: 16,
  },
});
