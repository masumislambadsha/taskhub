/* eslint-disable react-hooks/immutability */
import { ViewStyle, StyleSheet, Pressable } from "react-native";
import { useCallback, useRef } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface Props {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  variant?: "default" | "accent" | "auth" | "feature";
  onPress?: () => void;
  interactive?: boolean;
}

const styleConfig = StyleSheet.create({
  default: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  accent: {
    backgroundColor: '#004030',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#004030',
    padding: 16,
  },
  auth: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  feature: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,64,48,0.05)',
    padding: 20,
  },
});

export default function Card({ children, style, variant = "default", onPress, interactive }: Props) {
  const scale = useSharedValue(1);
  const elevation = useSharedValue(variant === "auth" ? 8 : 1);

  const animatedStyle = useAnimatedStyle(() => {
    if (!interactive) return {};
    return {
      transform: [{ scale: scale.value }],
      shadowOffset: { width: 0, height: elevation.value } as { width: number; height: number },
      shadowOpacity: variant === "auth" ? 0.1 + elevation.value * 0.01 : 0.03 + elevation.value * 0.02,
      shadowRadius: variant === "auth" ? 12 + elevation.value : 2 + elevation.value * 0.5,
      elevation: elevation.value,
    };
  });

  const handlePressIn = useCallback(() => {
    if (!interactive) return;
    scale.value = withSpring(0.98, { damping: 20, stiffness: 200 });
    elevation.value = withSpring(variant === "auth" ? 12 : 5, { damping: 20, stiffness: 200 });
  }, [interactive, variant]);

  const handlePressOut = useCallback(() => {
    if (!interactive) return;
    scale.value = withSpring(1, { damping: 20, stiffness: 200 });
    elevation.value = withSpring(variant === "auth" ? 8 : 1, { damping: 20, stiffness: 200 });
  }, [interactive, variant]);

  if (interactive && onPress) {
    const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styleConfig[variant], animatedStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <Animated.View style={[styleConfig[variant], interactive ? animatedStyle : {}, style]}>{children}</Animated.View>;
}
