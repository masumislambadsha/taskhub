import { useState, useCallback } from "react";
import { View, Text, ScrollView, Alert, StyleSheet } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Badge label={user.role} variant="active" />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{user.coins}</Text>
          <Text style={styles.statLabel}>Coins</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{totalTasks}</Text>
          <Text style={styles.statLabel}>Tasks Posted</Text>
        </Card>
      </View>

      <Card style={styles.logoutCard}>
        <Button title="Logout" onPress={handleLogout} variant="danger" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 9999,
    backgroundColor: '#004030',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#00281D',
  },
  email: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#004030',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  logoutCard: {
    padding: 16,
  },
});
