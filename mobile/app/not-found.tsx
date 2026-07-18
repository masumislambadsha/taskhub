import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FadeInView from "../src/components/animations/FadeInView";
import SlideInView from "../src/components/animations/SlideInView";
import ScaleOnPress from "../src/components/animations/ScaleOnPress";

export default function NotFound() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <FadeInView duration={600}>
          <View style={styles.iconContainer}>
            <View style={styles.iconWrapper}>
              <Ionicons name="document-text-outline" size={64} color="#4A9782" />
            </View>
            <View style={styles.dots}>
              <View style={[styles.dot, styles.dotRed]} />
              <View style={[styles.dot, styles.dotAmber]} />
              <View style={[styles.dot, styles.dotGreen]} />
            </View>
          </View>
        </FadeInView>

        <FadeInView delay={200} duration={500}>
          <Text style={styles.errorCode}>404</Text>
        </FadeInView>

        <SlideInView delay={300} direction="up">
          <Text style={styles.title}>Oops! This page seems to have vanished.</Text>
          <Text style={styles.desc}>The page you&apos;re looking for doesn&apos;t exist or has been moved.</Text>
        </SlideInView>

        <SlideInView delay={500} direction="up">
          <ScaleOnPress>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.push("/")} activeOpacity={1}>
              <Ionicons name="home-outline" size={18} color="#FFF" />
              <Text style={styles.homeBtnText}>Back to Home</Text>
            </TouchableOpacity>
          </ScaleOnPress>
        </SlideInView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5", justifyContent: "center", alignItems: "center", padding: 24 },
  content: { alignItems: "center", maxWidth: 320 },
  iconContainer: { position: "relative", marginBottom: 24 },
  iconWrapper: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  dots: { flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotRed: { backgroundColor: "#EF4444" },
  dotAmber: { backgroundColor: "#F59E0B" },
  dotGreen: { backgroundColor: "#4A9782" },
  errorCode: { fontSize: 80, fontWeight: "900", color: "rgba(0,64,48,0.08)", position: "absolute", top: -20, zIndex: -1 },
  title: { fontSize: 22, fontWeight: "700", color: "#00281D", textAlign: "center", marginBottom: 8 },
  desc: { fontSize: 14, color: "rgba(0,64,48,0.6)", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  homeBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#004030", paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  homeBtnText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
