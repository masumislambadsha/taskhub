import { useEffect, useRef } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

export default function PaymentReturn() {
  const { status, paymentId } = useLocalSearchParams<{ status: string; paymentId: string }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const timer = setTimeout(() => {
      if (status === "success" && paymentId) {
        router.replace(`/(buyer)/coins?success=1&paymentId=${paymentId}&confirmed=1`);
      } else {
        router.replace("/(buyer)/coins?cancelled=1");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#4A9782" />
        <Text style={styles.text}>Confirming your payment...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5", justifyContent: "center", alignItems: "center" },
  content: { alignItems: "center", gap: 12 },
  text: { fontSize: 14, color: "rgba(0,64,48,0.6)" },
});
