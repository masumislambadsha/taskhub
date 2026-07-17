import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import Button from "../../src/components/ui/Button";
import type { IConversation } from "../../src/types";

export default function Messages() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["worker-conversations"],
    queryFn: async () => {
      const res = await api.get<{ data: IConversation[] }>("/api/v1/messages");
      return res.data.data;
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleConversationPress = useCallback((conv: IConversation) => {
    Alert.alert("Messages", `Chat with ${conv.otherUserName}`);
  }, []);

  const renderConversation = useCallback(
    ({ item }: { item: IConversation }) => (
      <TouchableOpacity onPress={() => handleConversationPress(item)} activeOpacity={0.7}>
        <Card style={styles.convCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.convContent}>
            <View style={styles.convHeader}>
              <Text style={styles.convName} numberOfLines={1}>{item.otherUserName}</Text>
              <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.convPreview} numberOfLines={1}>{item.lastMessage}</Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </Card>
      </TouchableOpacity>
    ),
    [handleConversationPress],
  );

  if (isLoading && !data) return <Spinner message="Loading messages..." />;

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load messages</Text>
        <Button title="Retry" onPress={() => refetch()} variant="outline" style={{ marginTop: 12 }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversation}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState title="No conversations" message="Start chatting with buyers to see messages here" />}
      />
    </View>
  );
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  errorText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center" },
  list: { padding: 16, paddingTop: 16 },
  convCard: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  convContent: { flex: 1 },
  convHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  convName: { fontSize: 16, fontWeight: "600", color: COLORS.text, flex: 1, marginRight: 8 },
  convTime: { fontSize: 12, color: COLORS.textSecondary },
  convPreview: { fontSize: 14, color: COLORS.textSecondary },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginLeft: 8, paddingHorizontal: 6 },
  unreadText: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
});
