import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { API_BASE_URL } from "../../src/lib/constants";

type UserRole = "worker" | "buyer";

export default function Register() {
  const insets = useSafeAreaInsets();
  const { role: paramRole } = useLocalSearchParams<{ role?: string }>();

  const [step, setStep] = useState(paramRole === "worker" || paramRole === "buyer" ? 2 : 1);
  const [role, setRole] = useState<UserRole>((paramRole as UserRole) || "worker");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const roleCards: { value: UserRole; title: string; subtitle: string }[] = [
    { value: "worker", title: "Worker", subtitle: "Complete tasks & earn" },
    { value: "buyer", title: "Buyer", subtitle: "Post tasks & get work done" },
  ];

  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/register`, {
        name,
        email,
        password,
        confirmPassword,
        role,
      });
      return data;
    },
    onSuccess: () => {
      Alert.alert("Success", "Account created! Please sign in.", [
        { text: "OK", onPress: () => router.replace("/(auth)/login") },
      ]);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || "Registration failed";
      Alert.alert("Error", typeof msg === "string" ? msg : "Invalid input");
    },
  });

  const handleContinue = () => {
    if (role) setStep(2);
  };

  const isValidStep2 = name && email && password && confirmPassword;

  if (step === 1) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { paddingBottom: insets.bottom }]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.stepTitle}>Join TaskHub</Text>
          <Text style={styles.stepSubtitle}>How would you like to use TaskHub?</Text>

          <View style={styles.roleCardsContainer}>
            {roleCards.map((c) => {
              const selected = role === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  activeOpacity={0.7}
                  style={[styles.roleCard, selected ? styles.roleCardSelected : styles.roleCardUnselected]}
                  onPress={() => setRole(c.value)}
                >
                  <Text style={styles.roleCardTitle}>
                    {c.title}
                  </Text>
                  <Text style={[styles.roleCardSubtitle, selected ? styles.roleCardSubtitleFull : styles.roleCardSubtitleDim]}>
                    {c.subtitle}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!role}
            style={styles.fullWidth}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}>
          <Text style={styles.backButtonText}>{"< Back"}</Text>
        </TouchableOpacity>

        <Text style={styles.stepTitle}>Create your account</Text>
        <Text style={styles.stepSubtitle}>
          Signing up as a {role === "worker" ? "Worker" : "Buyer"}
        </Text>

        <View>
          <Button
            title="Continue with Google"
            variant="outline"
            onPress={() => Alert.alert("Coming Soon", "Google sign-up is not yet available on mobile.")}
            style={styles.fullWidth}
          />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or fill in your details</Text>
            <View style={styles.dividerLine} />
          </View>

          <Input
            label="Full Name"
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
          />
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
            placeholder="Min 6 characters"
            secureTextEntry
          />
          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat password"
            secureTextEntry
          />

          <Button
            title="Create Account"
            onPress={() => registerMutation.mutate()}
            loading={registerMutation.isPending}
            disabled={!isValidStep2}
            style={styles.fullWidth}
          />
        </View>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.footer}>
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.signupLink}>Sign in</Text>
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
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#004030', textAlign: 'center' },
  stepSubtitle: { fontSize: 16, color: 'rgba(0,64,48,0.6)', textAlign: 'center', marginTop: 4, marginBottom: 32 },
  roleCardsContainer: { gap: 16, marginBottom: 32 },
  roleCard: { borderWidth: 1.5, borderRadius: 16, padding: 24, alignItems: 'center' },
  roleCardSelected: { borderColor: '#4A9782', backgroundColor: 'rgba(74,151,130,0.05)' },
  roleCardUnselected: { backgroundColor: '#FFFFFF', borderColor: 'rgba(0,64,48,0.1)' },
  roleCardTitle: { fontSize: 20, fontWeight: '700', color: '#004030', marginBottom: 4 },
  roleCardSubtitle: { fontSize: 14, color: 'rgba(0,64,48,0.6)' },
  roleCardSubtitleFull: { opacity: 1 },
  roleCardSubtitleDim: { opacity: 0.8 },
  backButton: { alignSelf: 'flex-start', marginBottom: 16 },
  backButtonText: { fontSize: 16, color: 'rgba(0,64,48,0.6)', fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(0,64,48,0.1)' },
  dividerText: { marginHorizontal: 12, fontSize: 13, color: 'rgba(0,64,48,0.6)', opacity: 0.7 },
  footer: { marginTop: 24, alignItems: 'center', paddingBottom: 24 },
  footerText: { fontSize: 14, color: 'rgba(0,64,48,0.6)' },
  signupLink: { color: '#004030', fontWeight: '600' },
});
