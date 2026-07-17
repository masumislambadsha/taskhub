import { useState } from "react";
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
import { COLORS } from "../../src/lib/constants";
import Card from "../../src/components/ui/Card";
import Badge from "../../src/components/ui/Badge";
import Spinner from "../../src/components/ui/Spinner";
import EmptyState from "../../src/components/ui/EmptyState";
import type { IConversation } from "../../src/types";

export default function Messages() {
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["buyer-conversations"],
    queryFn: async () => {
      const { data } = await api.get<IConversation[]>("/api/v1/messages");
      return data;
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const conversations = Array.isArray(data) ? data : [];

  const renderConversation = ({ item }: { item: IConversation }) => (
    <TouchableOpacity activeOpacity={0.7}>
      <Card style={styles.conversationCard}>
        <View style={styles.convRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.convContent}>
            <View style={styles.convTop}>
              <Text style={styles.convName} numberOfLines={1}>{item.otherUserName}</Text>
              <Text style={styles.convTime}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.convBottom}>
              <Text style={styles.convLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
              {item.unreadCount > 0 && <Badge label={`${item.unreadCount}`} variant="info" />}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading && conversations.length === 0) return <Spinner message="Loading messages..." />;

  return (
    <View style={styles.container}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversation}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={<EmptyState title="No messages yet" message="Start a conversation by responding to a submission" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  list: { padding: 16, paddingTop: 16, paddingBottom: 32 },
  conversationCard: { marginBottom: 10 },
  convRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginRight: 12 },
  avatarText: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  convContent: { flex: 1 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 16, fontWeight: "600", color: COLORS.text, flex: 1 },
  convTime: { fontSize: 12, color: COLORS.textSecondary, marginLeft: 8 },
  convBottom: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8 },
  convLastMsg: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
});
