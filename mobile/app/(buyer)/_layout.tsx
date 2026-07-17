import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getUserData } from "../../src/lib/storage";
import { NAV_ITEMS } from "../../src/lib/constants";
import Sidebar from "../../src/components/Sidebar";
import Spinner from "../../src/components/ui/Spinner";

export default function BuyerLayout() {
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  useEffect(() => {
    (async () => {
      const raw = await getUserData();
      if (!raw) {
        router.replace("/(auth)/login");
        return;
      }
      const user = JSON.parse(raw);
      if (user.role !== "buyer") {
        router.replace(user.role === "worker" ? "/(worker)/dashboard" : "/(auth)/login");
        return;
      }
      setUserName(user.name || "Buyer");
      setUserRole(user.role || "buyer");
      setReady(true);
    })();
  }, []);

  if (!ready) return <Spinner />;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSidebarOpen(true)} style={styles.hamburger} activeOpacity={0.7}>
          <Ionicons name="menu-outline" size={26} color="#004030" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buyer</Text>
        <View style={styles.hamburger} />
      </View>

      <Stack screenOptions={{ headerShown: false }} />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={NAV_ITEMS.buyer}
        userName={userName}
        userRole="Buyer"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,64,48,0.05)",
    zIndex: 10,
  },
  hamburger: { width: 40, alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#004030" },
});
