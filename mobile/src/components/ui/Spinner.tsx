/* eslint-disable react-hooks/immutability */
import { useEffect } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";

interface Props {
  size?: "sm" | "md" | "lg" | "xl";
  message?: string;
  variant?: "hub" | "dot";
}

const SIZES = { sm: 32, md: 52, lg: 72, xl: 108 };

function OrbitingDot({ index, size, orbitSize }: { index: number; size: number; orbitSize: number }) {
  const angle = useSharedValue(0);
  const dotScale = useSharedValue(1);

  const labels = ["B", "✓", "W", "¢"];
  const colors = ["#4A9782", "#DCD0A8", "#4A9782", "#DCD0A8"];

  useEffect(() => {
    angle.value = withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false,
    );
    dotScale.value = withRepeat(
      withTiming(1.18, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const orbitStyle = useAnimatedStyle(() => {
    const rad = (angle.value + index * 90) * (Math.PI / 180);
    return {
      transform: [
        { translateX: Math.cos(rad) * orbitSize },
        { translateY: Math.sin(rad) * orbitSize },
        { scale: dotScale.value },
      ],
    };
  });

  const dotR = size * 0.065;
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: dotR * 2,
          height: dotR * 2,
          borderRadius: dotR,
          backgroundColor: colors[index],
          alignItems: "center",
          justifyContent: "center",
        },
        orbitStyle,
      ]}
    >
      <Text style={{ fontSize: dotR * 0.75, fontWeight: "800", color: index % 2 === 0 ? "#FFF" : "#004030" }}>
        {labels[index]}
      </Text>
    </Animated.View>
  );
}

function HubSpinner({ size }: { size: number }) {
  const dashRotate = useSharedValue(0);

  useEffect(() => {
    dashRotate.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const dashStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${dashRotate.value}deg` }],
  }));

  const dotR = size * 0.065;
  const orbitSize = size * 0.42;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          backgroundColor: "#004030",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#4A9782",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: size * 0.15,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: size * 0.22, fontWeight: "800", color: "#FFFFFF" }}>T</Text>
      </View>

      <Animated.View
        style={[
          {
            position: "absolute",
            width: orbitSize * 2 + dotR * 4,
            height: orbitSize * 2 + dotR * 4,
            borderRadius: orbitSize + dotR * 2,
            borderWidth: 1.5,
            borderColor: "rgba(74,151,130,0.2)",
            borderStyle: "dashed",
          },
          dashStyle,
        ]}
      />

      {[0, 1, 2, 3].map((i) => (
        <OrbitingDot key={i} index={i} size={size} orbitSize={orbitSize} />
      ))}
    </View>
  );
}

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.pulse, animatedStyle]}>
      <ActivityIndicator size="small" color="#FFF9E5" />
    </Animated.View>
  );
}

export default function Spinner({ size = "lg", message, variant = "hub" }: Props) {
  const px = SIZES[size] || SIZES.lg;

  return (
    <View style={styles.container}>
      {variant === "hub" ? <HubSpinner size={px} /> : <PulsingDot />}
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9E5",
    padding: 24,
  },
  pulse: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#004030",
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    marginTop: 20,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "#4A9782",
    textTransform: "uppercase",
  },
});
