import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { API_BASE_URL } from "../../src/lib/constants";
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
      try {
        await setToken(data.token);
        await setUserData(JSON.stringify(data.user));
        const role = data.user.role;
        if (role === "worker") router.replace("/(worker)/dashboard");
        else if (role === "buyer") router.replace("/(buyer)/dashboard");
        else router.replace("/(admin)/dashboard");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Failed to save session");
      }
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Login failed";
      Alert.alert("Error", msg);
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>TaskHub</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <Card variant="auth">
          <View>
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
              style={styles.fullWidth}
            />

            <TouchableOpacity onPress={() => router.push("/(auth)/forgot-password")} style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue with Google"
              variant="outline"
              onPress={() => Alert.alert("Coming Soon", "Google sign-in is not yet available on mobile.")}
              style={styles.fullWidth}
            />
          </View>
        </Card>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.footer}>
          <Text style={styles.footerText}>
            Don't have an account? <Text style={styles.signupLink}>Sign up</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9E5' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  fullWidth: { width: '100%' },
  title: { fontSize: 32, fontWeight: '800', color: '#004030', textAlign: 'center' },
  subtitle: { fontSize: 16, color: 'rgba(0,64,48,0.6)', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,64,48,0.1)' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: 'rgba(0,64,48,0.6)', opacity: 0.7 },
  forgotRow: { alignItems: 'center', marginTop: 12 },
  forgotText: { fontSize: 13, color: '#4A9782', fontWeight: '600' },
  footer: { marginTop: 24, alignItems: 'center', paddingBottom: 24 },
  footerText: { fontSize: 14, color: 'rgba(0,64,48,0.6)' },
  signupLink: { color: '#004030', fontWeight: '600' },
});
