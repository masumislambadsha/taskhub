import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import { getUserData, clearAll } from "../../src/lib/storage";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Button from "../../src/components/ui/Button";
import Spinner from "../../src/components/ui/Spinner";
import type { IUser, ISubmission, PaginatedResponse } from "../../src/types";

export default function Profile() {
  const [localUser, setLocalUser] = useState<IUser | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadUser();
    }, [])
  );

  async function loadUser() {
    const str = await getUserData();
    if (str) {
      try {
        setLocalUser(JSON.parse(str));
      } catch {}
    }
  }

  const meQuery = useQuery({
    queryKey: ["worker-profile-me"],
    queryFn: async () => {
      const res = await api.get<{ data: IUser }>("/api/v1/auth/me");
      return res.data.data;
    },
  });

  const submissionsQuery = useQuery({
    queryKey: ["worker-profile-submissions"],
    queryFn: async () => {
      const res = await api.get<PaginatedResponse<ISubmission>>("/api/v1/submissions", {
        params: { page: 1, limit: 100, status: "approved" },
      });
      return res.data;
    },
  });

  const user = meQuery.data || localUser;
  const totalEarnings = submissionsQuery.data?.data?.reduce((sum, s) => sum + (s.payableAmount || 0), 0) ?? 0;
  const tasksCompleted = submissionsQuery.data?.total ?? 0;

  const logout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await clearAll();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }, []);

  if (!user) return <Spinner message="Loading profile..." />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.userCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <Badge label={user.role} variant="active" />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{totalEarnings}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{user.coins}</Text>
          <Text style={styles.statLabel}>Coins Balance</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{tasksCompleted}</Text>
          <Text style={styles.statLabel}>Tasks Completed</Text>
        </Card>
      </View>

      <Card style={styles.settingsCard}>
        <Button title="Logout" onPress={logout} variant="danger" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  userCard: { alignItems: "center", paddingVertical: 24, marginBottom: 16 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarLargeText: { fontSize: 32, fontWeight: "700", color: "#FFFFFF" },
  userName: { fontSize: 20, fontWeight: "700", color: COLORS.text, marginBottom: 4 },
  userEmail: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statNumber: { fontSize: 22, fontWeight: "800", color: COLORS.primary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4, textAlign: "center" },
  settingsCard: { padding: 16 },
});
