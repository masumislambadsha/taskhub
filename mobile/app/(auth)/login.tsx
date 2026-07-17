import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { COLORS, API_BASE_URL } from "../../src/lib/constants";
import { setToken, setUserData } from "../../src/lib/storage";
import type { AuthResponse } from "../../src/types";

export default function Login() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post<AuthResponse>(`${API_BASE_URL}/api/v1/auth/login`, { email, password });
      return data;
    },
    onSuccess: async (data) => {
      await setToken(data.token);
      await setUserData(JSON.stringify(data.user));
      const role = data.user.role;
      if (role === "worker") router.replace("/(worker)/(tabs)/dashboard");
      else if (role === "buyer") router.replace("/(buyer)/(tabs)/dashboard");
      else router.replace("/(admin)/(tabs)/dashboard");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Login failed";
      Alert.alert("Error", msg);
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.flex, { paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>TaskHub</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <Card variant="auth" style={styles.card}>
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
            />

            <Button
              title="Sign in"
              onPress={() => loginMutation.mutate()}
              loading={loginMutation.isPending}
              disabled={!email || !password}
              style={styles.fullBtn}
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue with Google"
              variant="outline"
              onPress={() => {}}
              style={styles.fullBtn}
            />
          </View>
        </Card>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.linkWrap}>
          <Text style={styles.link}>
            Don't have an account? <Text style={styles.linkBold}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: COLORS.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 32,
  },
  card: {
    gap: 0,
  },
  form: {
    gap: 0,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#0040301A",
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: COLORS.textSecondary,
    opacity: 0.7,
  },
  fullBtn: {
    width: "100%",
  },
  linkWrap: {
    marginTop: 24,
    alignItems: "center",
    paddingBottom: 24,
  },
  link: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  linkBold: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});
