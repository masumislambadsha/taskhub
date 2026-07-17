import { useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
      {/* Top Header */}
      <SafeAreaView style={styles.headerSafeArea}>
        <View style={styles.header}>
          <View style={styles.headerLogo}>
            <View style={styles.logoIcon}>
              <Text style={styles.logoIconText}>T</Text>
            </View>
            <Text style={styles.logoText}>
              Task<Text style={styles.logoTextHighlight}>Hub</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowMore(true)}
            style={styles.menuBtn}
            activeOpacity={0.7}
          >
            <View style={styles.menuLine} />
            <View style={[styles.menuLine, { width: 16 }]} />
            <View style={styles.menuLine} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#004030",
          tabBarInactiveTintColor: "#00403099",
          tabBarStyle: {
            backgroundColor: "#FFFFFF",
            borderTopColor: "#004030",
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
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="browse-tasks"
          options={{
            tabBarLabel: "Browse Tasks",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="list-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leaderboard"
          options={{
            tabBarLabel: "Leaderboard",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="support"
          options={{
            tabBarLabel: "Support",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="headset-outline" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            tabBarLabel: "More",
            tabBarIcon: ({ color, size }) => (
              <Ionicons
                name="ellipsis-horizontal-outline"
                size={size}
                color={color}
              />
            ),
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMore(false)}
        >
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
                <Ionicons name={item.icon} size={22} color="#004030" />
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
  headerSafeArea: { backgroundColor: "#FFF9E5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF9E5",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,64,48,0.06)",
  },
  headerLogo: { flexDirection: "row", alignItems: "center", gap: 8 },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#004030",
    alignItems: "center",
    justifyContent: "center",
  },
  logoIconText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  logoText: { fontSize: 20, fontWeight: "800", color: "#004030" },
  logoTextHighlight: { color: "#4A9782" },
  menuBtn: { padding: 4, gap: 5, alignItems: "flex-end" },
  menuLine: {
    height: 2,
    width: 22,
    backgroundColor: "#004030",
    borderRadius: 2,
    marginVertical: 2,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#004030",
    marginBottom: 16,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,64,48,0.05)",
  },
  modalItemText: {
    fontSize: 16,
    color: "#004030",
    marginLeft: 14,
    fontWeight: "500",
  },
  modalClose: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#FFF9E5",
    borderRadius: 12,
  },
  modalCloseText: { fontSize: 16, fontWeight: "600", color: "#004030" },
});
