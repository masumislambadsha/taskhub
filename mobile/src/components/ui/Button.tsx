import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import { COLORS } from "../../lib/constants";

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "white";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  size?: "md" | "sm";
}

export default function Button({ title, onPress, variant = "primary", loading, disabled, style, size = "md" }: Props) {
  const isSm = size === "sm";
  const bgMap: Record<string, string> = {
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    outline: "transparent",
    ghost: "transparent",
    danger: COLORS.danger,
    white: "rgba(255,255,255,0.2)",
  };

  const txtColorMap: Record<string, string> = {
    primary: "#FFF",
    secondary: "#FFF",
    outline: COLORS.primary,
    ghost: COLORS.primary,
    danger: "#FFF",
    white: "#FFF",
  };

  const borderMap: Record<string, string> = {
    outline: COLORS.secondary,
    ghost: "transparent",
    white: "transparent",
    primary: "transparent",
    secondary: "transparent",
    danger: "transparent",
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        isSm && styles.sm,
        { backgroundColor: bgMap[variant], borderColor: borderMap[variant] },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={txtColorMap[variant]} size="small" />
      ) : (
        <Text style={[styles.text, isSm && styles.textSm, { color: txtColorMap[variant] }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  sm: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 18,
  },
  text: {
    fontSize: 16,
    fontWeight: "700",
  },
  textSm: {
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.6,
  },
});
