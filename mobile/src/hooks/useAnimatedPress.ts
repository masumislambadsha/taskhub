/* eslint-disable react-hooks/immutability */
import { useCallback } from "react";
import { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";

export function useAnimatedPress(scaleTo: number = 0.95) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pressIn = useCallback(() => {
    scale.value = withSpring(scaleTo, { damping: 15, stiffness: 200 });
  }, [scaleTo]);

  const pressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 200 });
  }, []);

  return { animatedStyle, pressIn, pressOut };
}
