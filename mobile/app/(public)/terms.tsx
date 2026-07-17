import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TermsPage() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#004030" />
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
      </View>
      <Text style={styles.body}>
        By using TaskHub you agree to our terms. All payments are processed securely. Misuse of the platform may result in account suspension.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#004030" },
  body: { fontSize: 16, color: "rgba(0,64,48,0.7)", lineHeight: 24 },
});
