import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../../lib/constants";

interface Props {
  title: string;
  message?: string;
  icon?: string;
}

export default function EmptyState({ title, message }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>!</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#0040300D", justifyContent: "center", alignItems: "center", marginBottom: 16 },
  iconText: { fontSize: 24, color: COLORS.textSecondary, opacity: 0.4 },
  title: { fontSize: 18, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  message: { fontSize: 14, color: COLORS.textSecondary, opacity: 0.6, textAlign: "center", marginTop: 8, lineHeight: 20 },
});
