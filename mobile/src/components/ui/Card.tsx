import { View, StyleSheet, ViewStyle } from "react-native";
import { COLORS } from "../../lib/constants";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: "default" | "accent" | "auth" | "feature";
}

export default function Card({ children, style, variant = "default" }: Props) {
  const v = variantStyles[variant] || variantStyles.default;
  return <View style={[styles.base, v, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: 12 },
});

const variantStyles = StyleSheet.create({
  default: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0040300D",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  accent: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  auth: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#0040300D",
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  feature: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#0040300D",
    padding: 20,
  },
});
