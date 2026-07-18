/* eslint-disable react-hooks/immutability */
import { Text, ActivityIndicator, ViewStyle, StyleSheet, Pressable } from "react-native";
import { useCallback } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "white";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  size?: "md" | "sm";
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
  },
  disabled: {
    opacity: 0.6,
  },
  sm: {
    height: 40,
    paddingHorizontal: 18,
  },
  md: {
    height: 48,
    paddingHorizontal: 24,
  },
  primary: {
    backgroundColor: '#004030',
    borderColor: '#004030',
  },
  secondary: {
    backgroundColor: '#4A9782',
    borderColor: '#4A9782',
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: '#4A9782',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  white: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'transparent',
  },
});

const textStyles = StyleSheet.create({
  base: {
    fontWeight: '700',
  },
  sm: {
    fontSize: 14,
    fontWeight: '600',
  },
  md: {
    fontSize: 16,
  },
  primary: { color: '#FFFFFF' },
  secondary: { color: '#FFFFFF' },
  outline: { color: '#004030' },
  ghost: { color: '#004030' },
  danger: { color: '#FFFFFF' },
  white: { color: '#FFFFFF' },
});

export default function Button({ title, onPress, variant = "primary", loading, disabled, style, size = "md" }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 200 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  return (
    <AnimatedPressable
      style={[
        styles.base,
        styles[variant],
        size === "sm" ? styles.sm : styles.md,
        disabled && styles.disabled,
        animatedStyle,
        style,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={variant === "outline" || variant === "ghost" ? "#004030" : "#FFF"} size="small" />
      ) : (
        <Text style={[
          textStyles.base,
          size === "sm" ? textStyles.sm : textStyles.md,
          textStyles[variant],
        ]}>{title}</Text>
      )}
    </AnimatedPressable>
  );
}
