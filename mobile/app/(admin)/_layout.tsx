import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getUserData } from "../../src/lib/storage";
import { NAV_ITEMS } from "../../src/lib/constants";
import Sidebar from "../../src/components/Sidebar";
import Spinner from "../../src/components/ui/Spinner";

export default function AdminLayout() {
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    (async () => {
      const raw = await getUserData();
      if (!raw) {
        router.replace("/(auth)/login");
        return;
      }
      const user = JSON.parse(raw);
      if (user.role !== "admin") {
        router.replace(
          user.role === "worker" ? "/(worker)/dashboard" : "/(buyer)/dashboard",
        );
        return;
      }
      setUserName(user.name || "Admin");
      setUserRole(user.role || "admin");
      setPhotoUrl(user.photoUrl);
      setCoins(user.coins ?? 0);
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
        <Text style={styles.headerTitle}>Admin</Text>
        <View style={styles.headerRight}>
          <View style={styles.coinBadge}>
            <Ionicons name="cash-outline" size={16} color="#DCD0A8" />
            <Text style={styles.coinBadgeText}>{coins.toLocaleString()}</Text>
          </View>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerAvatarInitial}>
                {(userName?.[0] || "U").toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right", animationDuration: 250 }} />

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navItems={NAV_ITEMS.admin}
        userName={userName}
        userRole="Admin"
        photoUrl={photoUrl}
        coins={coins}
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#004030", flex: 1, marginLeft: 8 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  coinBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,64,48,0.06)", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 16,
  },
  coinBadgeText: { fontSize: 13, fontWeight: "700", color: "#004030" },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#4A9782", justifyContent: "center", alignItems: "center",
  },
  headerAvatarInitial: { fontSize: 13, fontWeight: "700", color: "#FFFFFF" },
});
