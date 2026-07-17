import { useState, useCallback } from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const MORE_ITEMS = [
  { label: "How it Works", icon: "information-circle-outline" as const, route: "/(public)/" as const },
  { label: "FAQ", icon: "help-circle-outline" as const, route: "/(public)/faq" as const },
  { label: "About", icon: "information-outline" as const, route: "/(public)/about" as const },
  { label: "Privacy", icon: "shield-checkmark-outline" as const, route: "/(public)/privacy" as const },
  { label: "Terms", icon: "document-text-outline" as const, route: "/(public)/terms" as const },
];

export default function PublicLayout() {
  const [showMore, setShowMore] = useState(false);

  const handleMoreItem = useCallback((route: string) => {
    setShowMore(false);
    router.push(route);
  }, []);

  return (
    <>
      {/* Top Header */}
      <SafeAreaView style={styles.headerSafeArea} edges={["top"]}>
        <View style={styles.header}>
          {/* Logo matching web app */}
          <View style={styles.headerLogo}>
            {/* Hexagon icon built with Views */}
            <View style={styles.logoHex}>
              <View style={styles.logoTBar} />
              <View style={styles.logoTStem} />
              <View style={styles.logoCheckDot}>
                <Text style={styles.logoCheckText}>✓</Text>
              </View>
            </View>
            <Text style={styles.logoText}>
              Task<Text style={styles.logoTextHighlight}>Hub</Text>
            </Text>
          </View>
          {/* Bordered hamburger icon matching web */}
          <TouchableOpacity
            onPress={() => setShowMore(true)}
            style={styles.menuBtn}
            activeOpacity={0.7}
          >
            <View style={styles.menuLine} />
            <View
              style={[styles.menuLine, { width: 16, alignSelf: "flex-end" }]}
            />
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
        <Tabs.Screen name="faq" options={{ href: null }} />
        <Tabs.Screen name="about" options={{ href: null }} />
        <Tabs.Screen name="privacy" options={{ href: null }} />
        <Tabs.Screen name="terms" options={{ href: null }} />
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
                onPress={() => handleMoreItem(item.route)}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#FFF9E5",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,64,48,0.06)",
  },
  headerLogo: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoHex: {
    width: 34,
    height: 34,
    backgroundColor: "#004030",
    borderRadius: 8,
    overflow: "visible",
    position: "relative",
  },
  logoTBar: {
    position: "absolute",
    top: 9,
    left: 8,
    width: 18,
    height: 3.5,
    borderRadius: 1.75,
    backgroundColor: "#FFF9E5",
  },
  logoTStem: {
    position: "absolute",
    top: 9,
    left: 15.25,
    width: 3.5,
    height: 16,
    borderRadius: 1.75,
    backgroundColor: "#FFF9E5",
  },
  logoCheckDot: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#4A9782",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFF9E5",
  },
  logoCheckText: {
    color: "#FFF9E5",
    fontSize: 7,
    fontWeight: "900",
    lineHeight: 10,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#004030",
    letterSpacing: -0.5,
  },
  logoTextHighlight: { color: "#4A9782" },
  menuBtn: {
    width: 38,
    height: 38,
    borderWidth: 1.5,
    borderColor: "rgba(0,64,48,0.2)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
  },
  menuLine: {
    height: 2,
    width: 18,
    backgroundColor: "#004030",
    borderRadius: 2,
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
