import { useEffect } from "react";
import { ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

interface Props {
  children: React.ReactNode;
  delay?: number;
  direction?: "left" | "right" | "up" | "down";
  style?: ViewStyle;
}

const DIRECTION_MAP = {
  left: { x: -60, y: 0 },
  right: { x: 60, y: 0 },
  up: { x: 0, y: 60 },
  down: { x: 0, y: -60 },
};

export default function SlideInView({ children, delay = 0, direction = "up", style }: Props) {
  const offset = DIRECTION_MAP[direction];
  const translateX = useSharedValue(offset.x);
  const translateY = useSharedValue(offset.y);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      translateX.value = withSpring(0, { damping: 18, stiffness: 120 });
      translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
      opacity.value = withSpring(1);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
