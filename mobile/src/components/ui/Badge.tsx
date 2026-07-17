import { View, Text, StyleSheet } from "react-native";

type BadgeVariant =
  | "pending" | "approved" | "rejected"
  | "open" | "closed" | "blocked" | "archived"
  | "success" | "failed"
  | "active" | "suspended"
  | "info" | "warning" | "danger"
  | "default";

interface Props {
  label: string;
  variant?: BadgeVariant;
}

const colors: Record<string, { bg: string; text: string }> = {
  pending:  { bg: "#FEF3C7", text: "#92400E" },
  approved: { bg: "#D1FAE5", text: "#065F46" },
  rejected: { bg: "#FEE2E2", text: "#991B1B" },
  open:     { bg: "#DBEAFE", text: "#1E40AF" },
  closed:   { bg: "#F3F4F6", text: "#374151" },
  blocked:  { bg: "#FEE2E2", text: "#991B1B" },
  archived: { bg: "#F3F4F6", text: "#6B7280" },
  success:  { bg: "#D1FAE5", text: "#065F46" },
  failed:   { bg: "#FEE2E2", text: "#991B1B" },
  active:   { bg: "#D1FAE5", text: "#065F46" },
  suspended:{ bg: "#FEE2E2", text: "#991B1B" },
  info:     { bg: "#DBEAFE", text: "#1E40AF" },
  warning:  { bg: "#FEF3C7", text: "#92400E" },
  danger:   { bg: "#FEE2E2", text: "#991B1B" },
  default:  { bg: "#F3F4F6", text: "#374151" },
};

export default function Badge({ label, variant = "default" }: Props) {
  const c = colors[variant] || colors.default;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  text: { fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
});
