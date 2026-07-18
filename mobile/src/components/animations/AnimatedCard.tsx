/* eslint-disable react-hooks/immutability */
import { useCallback, useRef } from "react";
import { Pressable, ViewStyle, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  liftAmount?: number;
  disabled?: boolean;
  interactive?: boolean;
  variant?: "default" | "accent";
}

const variants: Record<string, ViewStyle> = {
  default: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  accent: {
    backgroundColor: '#004030',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
};

export default function AnimatedCard({ children, onPress, style, liftAmount = 4, disabled, interactive, variant = "default" }: Props) {
  const scale = useSharedValue(1);
  const elevation = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (!interactive) return {};
    return {
      transform: [{ scale: scale.value }],
      shadowOffset: { width: 0, height: elevation.value } as { width: number; height: number },
      shadowOpacity: 0.05 + elevation.value * 0.02,
      shadowRadius: 2 + elevation.value * 0.5,
      elevation: elevation.value,
    };
  });

  const handlePressIn = useCallback(() => {
    if (!interactive) return;
    scale.value = withSpring(0.98, { damping: 20, stiffness: 200 });
    elevation.value = withSpring(liftAmount, { damping: 20, stiffness: 200 });
  }, [interactive, liftAmount]);

  const handlePressOut = useCallback(() => {
    if (!interactive) return;
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    elevation.value = withSpring(0, { damping: 20, stiffness: 200 });
  }, [interactive]);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || !interactive}
      style={[variants[variant], interactive ? animatedStyle : {}, style]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
});
