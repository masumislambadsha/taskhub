import { useState } from "react";
import { View, Text, FlatList, RefreshControl, TouchableOpacity, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
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
        <View style={styles.conversationRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.userName} numberOfLines={1}>{item.otherUserName}</Text>
              <Text style={styles.lastDate}>{new Date(item.lastMessageAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.lastMessageRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
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
        contentContainerStyle={{ padding: 16, paddingTop: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
        ListEmptyComponent={<EmptyState title="No messages yet" message="Start a conversation by responding to a submission" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  conversationCard: {
    marginBottom: 10,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: '#004030',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
  },
  lastDate: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
    marginLeft: 8,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
    flex: 1,
  },
});
