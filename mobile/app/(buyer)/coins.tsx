import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS, COIN_PACKAGES } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { IPayment, PaginatedResponse, CoinPackage } from "../../src/types";

export default function Coins() {
  const [userCoins, setUserCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCoins();
    }, [])
  );

  async function loadCoins() {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setUserCoins(u.coins ?? 0);
      } catch {}
    }
  }

  const { data: paymentsData, refetch } = useQuery({
    queryKey: ["buyer-payments-history"],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IPayment>>("/api/v1/payments/history", { params: { page: 1, limit: 50 } });
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

  const payments = paymentsData?.data || [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      <Card variant="accent" style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Current Balance</Text>
        <Text style={styles.balanceAmount}>{userCoins}</Text>
      </Card>

      <Text style={styles.sectionTitle}>Buy Coins</Text>
      <Text style={styles.sectionSub}>Choose a package to purchase</Text>

      <View style={styles.packagesWrap}>
        {COIN_PACKAGES.map((pkg) => (
          <TouchableOpacity key={pkg.id} onPress={() => handleBuy(pkg)} activeOpacity={0.8}>
            <Card style={pkg.popular ? [styles.pkgCard, styles.pkgCardPopular] : styles.pkgCard}>
              {pkg.popular && (
                <View style={styles.popularBadge}>
                  <Badge label="Popular" variant="info" />
                </View>
              )}
              <Text style={styles.pkgLabel}>{pkg.label}</Text>
              <Text style={styles.pkgCoins}>{pkg.coins.toLocaleString()}</Text>
              <Text style={styles.pkgCoinsLabel}>coins</Text>
              <View style={styles.pkgDivider} />
              <Text style={styles.pkgPrice}>${pkg.price.toFixed(2)}</Text>
              <Button title="Buy Now" onPress={() => handleBuy(pkg)} variant={pkg.popular ? "primary" : "outline"} style={styles.pkgBtn} />
            </Card>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Payment History</Text>
      {payments.length === 0 ? (
        <EmptyState title="No purchases yet" message="Your payment history will appear here" />
      ) : (
        payments.map((p) => (
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
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  balanceCard: { alignItems: "center", paddingVertical: 24, marginBottom: 20 },
  balanceLabel: { fontSize: 14, color: COLORS.white, opacity: 0.8, marginTop: 8 },
  balanceAmount: { fontSize: 48, fontWeight: "800", color: COLORS.white, marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  sectionSub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 },
  packagesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 28 },
  pkgCard: { flex: 1, minWidth: "45%", alignItems: "center", paddingVertical: 20, position: "relative" },
  pkgCardPopular: { borderWidth: 2, borderColor: COLORS.primary },
  popularBadge: { position: "absolute", top: 8, right: 8 },
  pkgLabel: { fontSize: 14, color: COLORS.textSecondary },
  pkgCoins: { fontSize: 36, fontWeight: "800", color: COLORS.text, marginTop: 4 },
  pkgCoinsLabel: { fontSize: 13, color: COLORS.textSecondary },
  pkgDivider: { width: 40, height: 2, backgroundColor: "#00403033", marginVertical: 12 },
  pkgPrice: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  pkgBtn: { width: "100%" },
  paymentCard: { marginBottom: 10 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentCoins: { fontSize: 16, fontWeight: "600", color: COLORS.text },
  paymentMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  paymentDate: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
});
