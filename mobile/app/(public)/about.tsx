import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function AboutPage() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#004030" />
        </TouchableOpacity>
        <Text style={styles.title}>About TaskHub</Text>
      </View>
      <Text style={styles.body}>
        TaskHub is a premium marketplace connecting businesses with a global workforce for micro-tasks. We enable efficient task completion at scale while providing fair-wage opportunities to workers worldwide.
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
