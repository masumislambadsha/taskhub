import { useState } from "react";
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Input from "../../src/components/ui/Input";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import { COLORS, API_BASE_URL } from "../../src/lib/constants";

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
        style={[styles.flex, { paddingBottom: insets.bottom }]}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Join TaskHub</Text>
          <Text style={styles.subtitle}>How would you like to use TaskHub?</Text>

          <View style={styles.roleCards}>
            {roleCards.map((c) => {
              const selected = role === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  activeOpacity={0.7}
                  style={[
                    styles.roleCard,
                    selected && styles.roleCardSelected,
                  ]}
                  onPress={() => setRole(c.value)}
                >
                  <Text style={[styles.roleCardTitle, selected && styles.roleCardTitleSelected]}>
                    {c.title}
                  </Text>
                  <Text style={[styles.roleCardSubtitle, selected && styles.roleCardSubtitleSelected]}>
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
            style={styles.fullBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.flex, { paddingBottom: insets.bottom }]}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
          <Text style={styles.backText}>{"< Back"}</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>Create your account</Text>
        <Text style={styles.subtitle}>
          Signing up as a {role === "worker" ? "Worker" : "Buyer"}
        </Text>

        <View style={styles.formSection}>
          <Button
            title="Continue with Google"
            variant="outline"
            onPress={() => {}}
            style={styles.fullBtn}
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
            style={styles.fullBtn}
          />
        </View>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")} style={styles.linkWrap}>
          <Text style={styles.link}>
            Already have an account? <Text style={styles.linkBold}>Sign in</Text>
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
  heading: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 32,
  },
  roleCards: {
    gap: 16,
    marginBottom: 32,
  },
  roleCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: `${COLORS.primary}1A`,
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  roleCardSelected: {
    borderColor: COLORS.secondary,
    backgroundColor: `${COLORS.secondary}0D`,
  },
  roleCardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 4,
  },
  roleCardTitleSelected: {
    color: COLORS.text,
  },
  roleCardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    opacity: 0.8,
  },
  roleCardSubtitleSelected: {
    opacity: 1,
  },
  backBtn: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  formSection: {
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
