import { useState, useEffect } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { API_BASE_URL } from "../../src/lib/constants";

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/reset-password`, { token, password });
      return data;
    },
    onSuccess: () => {
      setDone(true);
      setTimeout(() => router.push("/(auth)/login"), 2500);
    },
    onError: (err: any) => {
      Alert.alert("Error", err?.response?.data?.error || "Something went wrong");
    },
  });

  function handleSubmit() {
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    mutation.mutate();
  }

  if (!token) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card variant="auth">
            <View style={styles.center}>
              <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
                <Ionicons name="close-circle" size={32} color="#EF4444" />
              </View>
              <Text style={styles.centerTitle}>Invalid link</Text>
              <Text style={styles.centerDesc}>This reset link is missing or malformed.</Text>
              <Button title="Request a new link" variant="outline" onPress={() => router.push("/(auth)/forgot-password")} />
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (done) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Card variant="auth">
            <View style={styles.center}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(74,151,130,0.1)" }]}>
                <Ionicons name="checkmark-circle" size={32} color="#4A9782" />
              </View>
              <Text style={styles.centerTitle}>Password updated</Text>
              <Text style={styles.centerDesc}>Your password has been reset. Redirecting you to sign in…</Text>
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
        <Text style={styles.subtitle}>Set a new password</Text>

        <Card variant="auth">
          <Input
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPassword}
          />
          <Input
            label="Confirm password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="••••••••"
            secureTextEntry={!showConfirm}
          />
          <Button
            title="Reset password"
            onPress={handleSubmit}
            loading={mutation.isPending}
            disabled={!password || !confirm}
            style={styles.fullWidth}
          />
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
  center: { alignItems: "center", paddingVertical: 8, gap: 12 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  centerTitle: { fontSize: 20, fontWeight: "700", color: "#004030" },
  centerDesc: { fontSize: 14, color: "rgba(0,64,48,0.6)", textAlign: "center", lineHeight: 20 },
});
