import { useState, useCallback } from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/lib/constants";

const MORE_ITEMS = [
  { label: "How it Works", icon: "information-circle-outline" as const },
  { label: "FAQ", icon: "help-circle-outline" as const },
  { label: "About", icon: "information-outline" as const },
  { label: "Privacy", icon: "shield-checkmark-outline" as const },
  { label: "Terms", icon: "document-text-outline" as const },
];

export default function PublicLayout() {
  const [showMore, setShowMore] = useState(false);

  const handleMoreItem = useCallback((label: string) => {
    setShowMore(false);
  }, []);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: COLORS.primary,
          tabBarInactiveTintColor: `${COLORS.textSecondary}99`,
          tabBarStyle: {
            backgroundColor: COLORS.white,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 60,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="browse-tasks"
          options={{
            tabBarLabel: "Browse Tasks",
            tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            tabBarLabel: "Leaderboard",
            tabBarIcon: ({ color, size }) => <Ionicons name="trophy-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="support"
          options={{
            tabBarLabel: "Support",
            tabBarIcon: ({ color, size }) => <Ionicons name="headset-outline" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            tabBarLabel: "More",
            tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-outline" size={size} color={color} />,
            tabBarButton: (props) => (
              <TouchableOpacity
                onPress={() => setShowMore(true)}
                style={props.style}
                activeOpacity={0.7}
              />
            ),
          }}
        />
      </Tabs>

      <Modal visible={showMore} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowMore(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>More</Text>
            {MORE_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.modalItem}
                onPress={() => handleMoreItem(item.label)}
                activeOpacity={0.7}
              >
                <Ionicons name={item.icon} size={22} color={COLORS.primary} />
                <Text style={styles.modalItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setShowMore(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#0040300D",
  },
  modalItemText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 14,
    fontWeight: "500",
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.primary,
  },
});
