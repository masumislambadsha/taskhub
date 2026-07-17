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

export default function Profile() {
  const [user, setUser] = useState<{ name: string; email: string; role: string; coins: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const raw = await getUserData();
        if (raw) setUser(JSON.parse(raw));
      })();
    }, [])
  );

  const { data: tasksData } = useQuery({
    queryKey: ["buyer-profile-tasks"],
    queryFn: async () => {
      const { data } = await api.get("/api/v1/tasks", { params: { page: 1, limit: 1 } });
      return data;
    },
    enabled: !!user,
  });

  const handleLogout = () => {
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
  };

  if (!user) return <Spinner message="Loading..." />;

  const totalTasks = tasksData?.total ?? 0;

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
          <Text style={styles.statNumber}>{user.coins}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statNumber}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Tasks Posted</Text>
        </Card>
      </View>

      <Card style={styles.settingsCard}>
        <Button title="Logout" onPress={handleLogout} variant="danger" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 40 },
  userCard: { alignItems: "center", paddingVertical: 24, marginBottom: 16 },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  avatarLargeText: { fontSize: 32, fontWeight: "700", color: "#FFFFFF" },
  userName: { fontSize: 22, fontWeight: "700", color: COLORS.text },
  userEmail: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4, marginBottom: 8 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, alignItems: "center", paddingVertical: 16 },
  statNumber: { fontSize: 24, fontWeight: "700", color: COLORS.primary },
  statLabel: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  settingsCard: { padding: 16 },
});
