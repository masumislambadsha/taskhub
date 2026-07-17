import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Alert,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { IUser, PaginatedResponse } from "../../src/types";
import Input from "../../src/components/ui/Input";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";

const roleBadgeVariant: Record<string, "active" | "approved" | "pending" | "suspended" | "default"> = {
  admin: "active",
  worker: "pending",
  buyer: "approved",
};

const statusBadgeVariant: Record<string, "active" | "suspended"> = {
  active: "active",
  suspended: "suspended",
};

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, isRefetching, refetch } = useQuery<PaginatedResponse<IUser>>({
    queryKey: ["admin", "users", page, debouncedSearch],
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<IUser>>(
        "/api/v1/admin/users",
        { params: { page, limit: 20, search: debouncedSearch || undefined } },
      );
      return data;
    },
  });

  const users = data?.data ?? [];
  const totalPages = data?.pages ?? 1;

  const toggleStatusMutation = useMutation({
    mutationFn: async (user: IUser) => {
      const newStatus = user.status === "suspended" ? "active" : "suspended";
      await api.put(`/api/v1/admin/users/${user._id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to update user");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await api.put(`/api/v1/admin/users/${userId}`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to update role");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/api/v1/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Failed to delete user");
    },
  });

  const handleUserPress = useCallback(
    (user: IUser) => {
      Alert.alert(
        user.name,
        `Email: ${user.email}\nRole: ${user.role}\nStatus: ${user.status}\nCoins: ${user.coins}\nJoined: ${new Date(user.createdAt).toLocaleDateString()}`,
        [
          {
            text: user.status === "suspended" ? "Activate" : "Suspend",
            onPress: () => toggleStatusMutation.mutate(user),
          },
          {
            text: "Change Role",
            onPress: () => {
              Alert.alert("Select Role", undefined, [
                {
                  text: "Worker",
                  onPress: () => updateRoleMutation.mutate({ userId: user._id, role: "worker" }),
                },
                {
                  text: "Buyer",
                  onPress: () => updateRoleMutation.mutate({ userId: user._id, role: "buyer" }),
                },
                {
                  text: "Admin",
                  onPress: () => updateRoleMutation.mutate({ userId: user._id, role: "admin" }),
                },
                { text: "Cancel", style: "cancel" },
              ]);
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              Alert.alert("Confirm Delete", `Delete ${user.name}? This cannot be undone.`, [
                { text: "Delete", style: "destructive", onPress: () => deleteUserMutation.mutate(user._id) },
                { text: "Cancel", style: "cancel" },
              ]);
            },
          },
        ],
      );
    },
    [toggleStatusMutation, updateRoleMutation, deleteUserMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: IUser }) => (
      <TouchableOpacity onPress={() => handleUserPress(item)} activeOpacity={0.7}>
        <Card style={styles.userCard}>
          <View style={styles.userHeader}>
            <Text style={styles.userName}>{item.name}</Text>
            <View style={styles.badgesRow}>
              <Badge label={item.role} variant={roleBadgeVariant[item.role] ?? "default"} />
              <View style={{ width: 6 }} />
              <Badge label={item.status} variant={statusBadgeVariant[item.status] ?? "default"} />
            </View>
          </View>
          <Text style={styles.userEmail}>{item.email}</Text>
          <View style={styles.userFooter}>
            <Text style={styles.coinsText}>{item.coins} coins</Text>
            <Text style={styles.joinDate}>Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </Card>
      </TouchableOpacity>
    ),
    [handleUserPress],
  );

  const loadMore = () => {
    if (!isFetching && page < totalPages) setPage((prev) => prev + 1);
  };

  if (isLoading) return <Spinner message="Loading users..." />;

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input placeholder="Search by name or email..." value={search} onChangeText={setSearch} autoCapitalize="none" />
      </View>
      <FlatList
        data={users}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { setPage(1); refetch(); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState title="No users found" message={search ? "Try a different search term" : "No users have registered yet"} />}
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
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  userCard: {
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00281D',
    flex: 1,
  },
  badgesRow: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    marginTop: 4,
  },
  userFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  coinsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#004030',
  },
  joinDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  footer: {
    paddingVertical: 16,
  },
});
