import { useEffect } from "react";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from "react-native-reanimated";

interface Config {
  delay?: number;
  duration?: number;
  spring?: boolean;
}

export function useFadeIn({ delay = 0, duration = 500, spring }: Config = {}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (spring) {
        opacity.value = withSpring(1);
        translateY.value = withSpring(0);
      } else {
        opacity.value = withTiming(1, { duration, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, { duration, easing: Easing.out(Easing.cubic) });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

export function useSlideIn(direction: "left" | "right" | "up" | "down" = "up", { delay = 0, spring }: Config = {}) {
  const offsets = { left: { x: -60, y: 0 }, right: { x: 60, y: 0 }, up: { x: 0, y: 60 }, down: { x: 0, y: -60 } };
  const offset = offsets[direction];

  const translateX = useSharedValue(offset.x);
  const translateY = useSharedValue(offset.y);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (spring) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        opacity.value = withSpring(1);
      } else {
        translateX.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        opacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));
}

export function useScaleIn({ delay = 0, spring }: Config = {}) {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (spring) {
        scale.value = withSpring(1);
        opacity.value = withSpring(1);
      } else {
        scale.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.back(1.5)) });
        opacity.value = withTiming(1, { duration: 300 });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
}
