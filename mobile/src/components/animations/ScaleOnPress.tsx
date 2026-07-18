/* eslint-disable react-hooks/immutability */
import { useCallback } from "react";
import { Pressable, PressableProps, GestureResponderEvent } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends PressableProps {
  children: React.ReactNode;
  scaleTo?: number;
  style?: PressableProps['style'];
}

export default function ScaleOnPress({ children, scaleTo = 0.95, onPressIn, onPressOut, style, ...props }: Props) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback((e: GestureResponderEvent) => {
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
    onPressIn?.(e);
  }, [scaleTo, onPressIn]);

  const handlePressOut = useCallback((e: GestureResponderEvent) => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
    onPressOut?.(e);
  }, [onPressOut]);

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
