import { ActivityIndicator, StyleSheet, View, Text } from "react-native";
import { COLORS } from "../../lib/constants";

interface Props {
  size?: "small" | "large";
  message?: string;
}

export default function Spinner({ size = "large", message }: Props) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={COLORS.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, padding: 24 },
  message: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary, opacity: 0.6 },
});
