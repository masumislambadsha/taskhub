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

const bgColors: Record<string, string> = {
  pending:   '#FEF3C7',
  approved:  '#D1FAE5',
  rejected:  '#FEE2E2',
  open:      '#DBEAFE',
  closed:    '#F3F4F6',
  blocked:   '#FEE2E2',
  archived:  '#F3F4F6',
  success:   '#D1FAE5',
  failed:    '#FEE2E2',
  active:    '#D1FAE5',
  suspended: '#FEE2E2',
  info:      '#DBEAFE',
  warning:   '#FEF3C7',
  danger:    '#FEE2E2',
  default:   '#F3F4F6',
};

const textColors: Record<string, string> = {
  pending:   '#92400E',
  approved:  '#065F46',
  rejected:  '#991B1B',
  open:      '#1E40AF',
  closed:    '#374151',
  blocked:   '#991B1B',
  archived:  '#6B7280',
  success:   '#065F46',
  failed:    '#991B1B',
  active:    '#065F46',
  suspended: '#991B1B',
  info:      '#1E40AF',
  warning:   '#92400E',
  danger:    '#991B1B',
  default:   '#374151',
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

export default function Badge({ label, variant = "default" }: Props) {
  const v = variant in bgColors ? variant : "default";
  return (
    <View style={[styles.badge, { backgroundColor: bgColors[v] }]}>
      <Text style={[styles.text, { color: textColors[v] }]}>{label}</Text>
    </View>
  );
}
