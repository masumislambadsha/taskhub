import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const FAQ_ITEMS = [
  { q: "How do I withdraw my earnings?", a: "Minimum 200 coins. We support bKash and SSLCommerz. Payments processed within 24 hours." },
  { q: "What kind of tasks are available?", a: "Data labeling, content moderation, surveys, image annotation, writing, app testing, social media, research." },
  { q: "How does the coin system work?", a: "Buyers purchase 10 coins for $1. Workers withdraw $1 per 20 coins earned." },
  { q: "How is quality maintained?", a: "Buyer review, worker reputation scores, and submission proof requirements." },
  { q: "How do I get started as a buyer?", a: "Register, purchase coins, post your first task." },
  { q: "What if my submission is rejected?", a: "No coins are deducted from the buyer. You get feedback to improve." },
];

export default function FAQPage() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#004030" />
        </TouchableOpacity>
        <Text style={styles.title}>FAQ</Text>
      </View>
      {FAQ_ITEMS.map((item, i) => (
        <View key={i} style={styles.item}>
          <Text style={styles.q}>{item.q}</Text>
          <Text style={styles.a}>{item.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5", padding: 16 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#004030" },
  item: { backgroundColor: "#FFFFFF", padding: 16, borderRadius: 12, marginBottom: 12 },
  q: { fontSize: 16, fontWeight: "600", color: "#004030", marginBottom: 8 },
  a: { fontSize: 14, color: "rgba(0,64,48,0.6)", lineHeight: 20 },
});
