import { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COIN_PACKAGES } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { IPayment, CoinPackage } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Coins() {
  const [userCoins, setUserCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadCoins = useCallback(async () => {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setUserCoins(u.coins ?? 0);
      } catch {}
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCoins();
    }, [])
  );

  const { data: paymentsData, refetch } = useQuery({
    queryKey: ["buyer-payments-history"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IPayment, 'payments'>>("/api/v1/payments/history", { params: { page: 1, limit: 50 } });
      return data;
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageId: string) => {
      const { data } = await api.post("/api/v1/payments/create-session", { packageId });
      return data;
    },
    onSuccess: () => {
      Alert.alert("Success", "Purchase initiated!");
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Purchase failed");
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    await loadCoins();
    setRefreshing(false);
  };

  const handleBuy = (pkg: CoinPackage) => {
    Alert.alert(
      `Buy ${pkg.label} Package`,
      `${pkg.coins} coins for $${pkg.price.toFixed(2)}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Buy Now", onPress: () => purchaseMutation.mutate(pkg.id) },
      ]
    );
  };

  const payments = paymentsData?.payments || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      <Card variant="accent" style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceValue}>{userCoins}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Buy Coins</Text>
      <Text style={styles.sectionSubtitle}>Choose a package to purchase</Text>

      <View style={styles.packagesRow}>
        {COIN_PACKAGES.map((pkg) => (
          <TouchableOpacity key={pkg.id} onPress={() => handleBuy(pkg)} activeOpacity={0.8}>
            <Card style={pkg.popular ? [styles.packageCard, styles.popularPackageCard] : styles.packageCard}>
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Badge label="Popular" variant="info" />
                </View>
              )}
              <Text style={styles.packageLabel}>{pkg.label}</Text>
              <Text style={styles.packageCoins}>{pkg.coins.toLocaleString()}</Text>
              <Text style={styles.packageCoinsLabel}>coins</Text>
              <View style={styles.packageDivider} />
              <Text style={styles.packagePrice}>${pkg.price.toFixed(2)}</Text>
              <Button title="Buy Now" onPress={() => handleBuy(pkg)} variant={pkg.popular ? "primary" : "outline"} style={styles.buyBtn} />
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Payment History</Text>
      {payments.length === 0 ? (
        <EmptyState title="No purchases yet" message="Your payment history will appear here" />
      ) : (
        payments.map((p: IPayment) => (
          <Card key={p._id} style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <View>
                <Text style={styles.paymentCoins}>{p.coinsPurchased} coins</Text>
                <Text style={styles.paymentMeta}>{p.gateway.toUpperCase()} · ${p.amount.toFixed(2)}</Text>
                <Text style={styles.paymentDate}>{new Date(p.createdAt).toLocaleDateString()}</Text>
              </View>
              <Badge
                label={p.status}
                variant={p.status === "success" ? "approved" : p.status === "failed" ? "rejected" : "pending"}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  balanceCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  balanceValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginBottom: 16,
  },
  packagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  packageCard: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  popularPackageCard: {
    borderWidth: 2,
    borderColor: '#004030',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  packageLabel: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  packageCoins: {
    fontSize: 36,
    fontWeight: '700',
    color: '#00281D',
    marginTop: 4,
  },
  packageCoinsLabel: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  packageDivider: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(0,64,48,0.2)',
    marginVertical: 12,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  buyBtn: {
    width: '100%',
  },
  paymentCard: {
    marginBottom: 10,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentCoins: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  paymentMeta: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  paymentDate: {
    fontSize: 11,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
});
