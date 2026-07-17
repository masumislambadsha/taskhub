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
  const totalEarnings = submissionsQuery.data?.submissions?.reduce((sum, s) => sum + (s.payableAmount || 0), 0) ?? 0;
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
    <ScrollView style={styles.scrollView} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
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
          <Text style={styles.statValue}>{totalEarnings}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{user.coins}</Text>
          <Text style={styles.statLabel}>Coins Balance</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{tasksCompleted}</Text>
          <Text style={styles.statLabel}>Tasks Completed</Text>
        </Card>
      </View>

      <Card style={styles.logoutCard}>
        <Button title="Logout" onPress={logout} variant="danger" />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
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
    borderRadius: 36,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#00281D',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
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
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  logoutCard: {
    padding: 16,
  },
});
