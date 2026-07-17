import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, Alert, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import api from "../../src/lib/api";
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
        <Card style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.otherUserName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.convContent}>
            <View style={styles.convHeader}>
              <Text style={styles.convName} numberOfLines={1}>{item.otherUserName}</Text>
              <Text style={styles.convTime}>{formatTime(item.lastMessageAt)}</Text>
            </View>
            <Text style={styles.convLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
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
      <View style={styles.errorContainer}>
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
        contentContainerStyle={{ padding: 16, paddingTop: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#004030" />}
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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF9E5',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(0,64,48,0.6)',
    textAlign: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF9E5',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  convContent: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  convName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00281D',
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 12,
    color: 'rgba(0,64,48,0.6)',
  },
  convLastMsg: {
    fontSize: 14,
    color: 'rgba(0,64,48,0.6)',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#004030',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
