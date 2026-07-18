/* eslint-disable react-hooks/immutability */
import { useEffect, Children, isValidElement, cloneElement } from "react";
import { View, ViewStyle } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, withDelay, withSpring } from "react-native-reanimated";

interface Props {
  children: React.ReactNode;
  staggerDelay?: number;
  direction?: "up" | "down" | "left" | "right";
  style?: ViewStyle;
}

const DIRECTION_OFFSET = {
  up: { x: 0, y: 30 },
  down: { x: 0, y: -30 },
  left: { x: 30, y: 0 },
  right: { x: -30, y: 0 },
};

function StaggerItem({ children, delay, offset }: { children: React.ReactNode; delay: number; offset: { x: number; y: number } }) {
  const translateX = useSharedValue(offset.x);
  const translateY = useSharedValue(offset.y);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
    translateY.value = withDelay(delay, withSpring(0, { damping: 18, stiffness: 120 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function StaggerContainer({ children, staggerDelay = 80, direction = "up", style }: Props) {
  const offset = DIRECTION_OFFSET[direction];

  return (
    <View style={style}>
      {Children.map(children, (child, index) => {
        if (isValidElement(child)) {
          return (
            <StaggerItem delay={index * staggerDelay} offset={offset}>
              {child}
            </StaggerItem>
          );
        }
        return child;
      })}
    </View>
  );
}
