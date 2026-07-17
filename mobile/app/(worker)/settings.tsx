import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { clearAuth } from "../../src/lib/storage";
import { router } from "expo-router";
import Card from "../../src/components/ui/Card";

export default function Settings() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Account and app preferences</Text>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <Ionicons name="person-outline" size={22} color="#004030" />
          <Text style={styles.rowText}>Edit Profile</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(0,64,48,0.3)" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <Ionicons name="notifications-outline" size={22} color="#004030" />
          <Text style={styles.rowText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(0,64,48,0.3)" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={22} color="#004030" />
          <Text style={styles.rowText}>Privacy</Text>
          <Ionicons name="chevron-forward" size={18} color="rgba(0,64,48,0.3)" />
        </TouchableOpacity>
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <Ionicons name="moon-outline" size={22} color="#004030" />
          <Text style={styles.rowText}>Dark Mode</Text>
          <Text style={styles.rowValue}>Off</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} activeOpacity={0.7}>
          <Ionicons name="language-outline" size={22} color="#004030" />
          <Text style={styles.rowText}>Language</Text>
          <Text style={styles.rowValue}>English</Text>
        </TouchableOpacity>
      </Card>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={async () => {
          await clearAuth();
          router.replace("/(public)");
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="log-out-outline" size={22} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#004030" },
  subtitle: { fontSize: 14, color: "rgba(0,64,48,0.6)", marginTop: 4, marginBottom: 20 },
  section: { marginBottom: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "rgba(0,64,48,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 4, gap: 12 },
  rowText: { flex: 1, fontSize: 16, fontWeight: "500", color: "#00281D" },
  rowValue: { fontSize: 14, color: "rgba(0,64,48,0.4)" },
  divider: { height: 1, backgroundColor: "rgba(0,64,48,0.05)", marginHorizontal: 4 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, marginTop: 8 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
});
