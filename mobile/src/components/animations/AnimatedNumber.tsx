/* eslint-disable react-hooks/immutability */
import { useEffect, useState } from "react";
import Animated, { useSharedValue, useAnimatedProps, withTiming, Easing } from "react-native-reanimated";
import { Text, TextProps } from "react-native";

Animated.addWhitelistedNativeProps({ text: true });

const AnimatedText = Animated.createAnimatedComponent(Text);

interface Props extends TextProps {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  suffix?: string;
  prefix?: string;
}

export default function AnimatedNumber({ value, duration = 800, format, suffix = "", prefix = "", ...props }: Props) {
  const animatedValue = useSharedValue(0);
  const [displayText, setDisplayText] = useState(prefix + "0" + suffix);

  useEffect(() => {
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    });

    const interval = setInterval(() => {
      const current = animatedValue.value;
      if (format) {
        setDisplayText(prefix + format(current) + suffix);
      } else {
        setDisplayText(prefix + Math.round(current).toString() + suffix);
      }
    }, 32);

    setTimeout(() => {
      clearInterval(interval);
      if (format) {
        setDisplayText(prefix + format(value) + suffix);
      } else {
        setDisplayText(prefix + value.toString() + suffix);
      }
    }, duration);

    return () => clearInterval(interval);
  }, [value]);

  return (
    <Text {...props}>{displayText}</Text>
  );
}
