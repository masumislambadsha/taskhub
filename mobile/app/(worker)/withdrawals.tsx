import { useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, RefreshControl, Alert, StyleSheet } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { MIN_WITHDRAWAL_COINS, COINS_PER_DOLLAR_WITHDRAW } from "../../src/lib/constants";
import { getUserData } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { IWithdrawal } from "../../src/types";
import type { PaginatedResponse } from "../../src/types";

export default function Withdrawals() {
  const [coins, setCoins] = useState("");
  const [paymentSystem, setPaymentSystem] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [userCoins, setUserCoins] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const loadUserCoins = useCallback(async () => {
    const str = await getUserData();
    if (str) {
      try {
        const u = JSON.parse(str);
        setUserCoins(u.coins ?? 0);
      } catch {}
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUserCoins();
  }, []);

  const coinNum = parseInt(coins) || 0;
  const usdAmount = (coinNum / COINS_PER_DOLLAR_WITHDRAW).toFixed(2);
  const canSubmit = coinNum >= MIN_WITHDRAWAL_COINS && coinNum <= userCoins && paymentSystem.trim().length > 0 && accountNumber.trim().length > 0;

  const { data: withdrawals, isLoading, isError, refetch } = useQuery({
    queryKey: ["worker-withdrawals"],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<IWithdrawal, 'withdrawals'>>("/api/v1/withdrawals", { params: { page: 1, limit: 50 } });
      return res.data;
    },
  });

  const withdrawalMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/api/v1/withdrawals", {
        coinRequested: coinNum,
        paymentSystem: paymentSystem.trim(),
        accountNumber: accountNumber.trim(),
      });
      return res.data;
    },
    onSuccess: async () => {
      Alert.alert("Success", "Withdrawal request submitted");
      setCoins("");
      setPaymentSystem("");
      setAccountNumber("");
      await queryClient.invalidateQueries({ queryKey: ["worker-withdrawals"] });
      await loadUserCoins();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Withdrawal request failed");
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    await loadUserCoins();
    setRefreshing(false);
  }, [refetch]);

  const withdrawalList = withdrawals?.withdrawals ?? [];

  if (isLoading && !withdrawals) return <Spinner message="Loading..." />;

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
    >
      <Card variant="accent" style={styles.accentCard}>
        <Text style={styles.accentLabel}>Your Balance</Text>
        <Text style={styles.accentValue}>{userCoins}</Text>
        <Text style={styles.accentSubtext}>Minimum {MIN_WITHDRAWAL_COINS} coins to withdraw</Text>
      </Card>

      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>Request Withdrawal</Text>
        <Input
          label="Payment System"
          placeholder="e.g. bkash, nagad"
          value={paymentSystem}
          onChangeText={setPaymentSystem}
          autoCapitalize="none"
        />
        <Input
          label="Account Number"
          placeholder="Enter account number"
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="numeric"
        />
        <Input
          label="Amount (Coins)"
          placeholder="Enter coin amount"
          value={coins}
          onChangeText={setCoins}
          keyboardType="numeric"
        />
        {coinNum > 0 && <Text style={styles.hintText}>≈ ${usdAmount} USD</Text>}
        {coinNum > 0 && coinNum < MIN_WITHDRAWAL_COINS && (
          <Text style={styles.errorHint}>Minimum {MIN_WITHDRAWAL_COINS} coins required</Text>
        )}
        {coinNum > userCoins && <Text style={styles.errorHint}>Insufficient balance</Text>}
        <Button
          title="Submit Request"
          onPress={() => withdrawalMutation.mutate()}
          loading={withdrawalMutation.isPending}
          disabled={!canSubmit}
          style={{ marginTop: 8 }}
        />
      </Card>

      <Text style={styles.sectionTitle}>Recent Withdrawals</Text>
      {withdrawalList.length > 0 ? (
        withdrawalList.map((w: IWithdrawal) => (
          <Card key={w._id} style={styles.withdrawalCard}>
            <View style={styles.withdrawalHeader}>
              <View style={styles.withdrawalInfo}>
                <Text style={styles.withdrawalAmount}>{w.coinRequested} coins (${w.amount})</Text>
                <Text style={styles.withdrawalMethod}>{w.paymentSystem} - {w.accountNumber}</Text>
              </View>
              <Badge label={w.status} variant={w.status as "pending" | "approved" | "rejected"} />
            </View>
            <Text style={styles.withdrawalDate}>{new Date(w.createdAt).toLocaleDateString()}</Text>
          </Card>
        ))
      ) : isError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load withdrawals</Text>
          <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 8 }} />
        </View>
      ) : (
        <EmptyState title="No withdrawals yet" message="Your withdrawal requests will appear here" />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  accentCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  accentLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  accentValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  accentSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  formCard: {
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 16,
  },
  hintText: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: -8,
    marginBottom: 8,
    textAlign: 'right',
  },
  errorHint: {
    fontSize: 14,
    color: '#EF4444',
    marginTop: -8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#004030',
    marginBottom: 12,
  },
  withdrawalCard: {
    marginBottom: 12,
  },
  withdrawalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  withdrawalInfo: {
    flex: 1,
    marginRight: 8,
  },
  withdrawalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
  },
  withdrawalMethod: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 2,
  },
  withdrawalDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
  },
});
