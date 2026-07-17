import { View, Text, StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { COLORS } from "../../src/lib/constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AuthLayout() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.logo}>TaskHub</Text>
      </View>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  logo: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.primary,
  },
});
