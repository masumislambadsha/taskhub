import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { API_BASE_URL } from "../../src/lib/constants";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/forgot-password`, { email });
      return data;
    },
    onSuccess: () => setSent(true),
    onError: () => Alert.alert("Error", "Something went wrong. Please try again."),
  });

  if (sent) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Card variant="auth">
            <View style={styles.sentContainer}>
              <View style={styles.sentIcon}>
                <Ionicons name="mail-open" size={32} color="#4A9782" />
              </View>
              <Text style={styles.sentTitle}>Check your inbox</Text>
              <Text style={styles.sentDesc}>
                If an account exists for{" "}
                <Text style={styles.sentEmail}>{email}</Text>, we sent a password
                reset link. It expires in 1 hour.
              </Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.backLink}>Back to sign in</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>TaskHub</Text>
        <Text style={styles.subtitle}>Forgot your password?</Text>

        <Card variant="auth">
          <Text style={styles.infoText}>Enter your email and we&apos;ll send you a reset link.</Text>
          <Input
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title="Send reset link"
            onPress={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!email}
            style={styles.fullWidth}
          />
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.footerText}>
                Remember your password? <Text style={styles.signinLink}>Sign in</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF9E5" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
  fullWidth: { width: "100%" },
  title: { fontSize: 32, fontWeight: "800", color: "#004030", textAlign: "center" },
  subtitle: { fontSize: 16, color: "rgba(0,64,48,0.6)", textAlign: "center", marginTop: 8, marginBottom: 32 },
  infoText: { fontSize: 14, color: "rgba(0,64,48,0.6)", marginBottom: 20, textAlign: "center" },
  sentContainer: { alignItems: "center", paddingVertical: 8, gap: 12 },
  sentIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(74,151,130,0.1)", alignItems: "center", justifyContent: "center" },
  sentTitle: { fontSize: 20, fontWeight: "700", color: "#004030" },
  sentDesc: { fontSize: 14, color: "rgba(0,64,48,0.6)", textAlign: "center", lineHeight: 20 },
  sentEmail: { fontWeight: "600", color: "#004030" },
  backLink: { color: "#4A9782", fontWeight: "600", fontSize: 14, marginTop: 8 },
  footer: { marginTop: 24, alignItems: "center" },
  footerText: { fontSize: 14, color: "rgba(0,64,48,0.6)" },
  signinLink: { color: "#4A9782", fontWeight: "600" },
});
