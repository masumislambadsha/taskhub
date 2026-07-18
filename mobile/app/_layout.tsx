/* eslint-disable react-hooks/immutability */
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { View, Text, StyleSheet } from "react-native";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  Inter_300Light,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30000 } },
});

function AnimatedSplash() {
  const pulse = useSharedValue(1);
  const dotY = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.06, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    dotY.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + dotY.value * 0.5,
    transform: [{ scale: 0.8 + dotY.value * 0.2 }],
  }));

  return (
    <View style={styles.splash}>
      <Animated.View style={[styles.logoHex, pulseStyle]}>
        <View style={styles.hexInner}>
          <View style={styles.logoTShape}>
            <View style={styles.logoBar} />
            <View style={styles.logoStem} />
          </View>
        </View>
        <Animated.View style={[styles.checkDot, dotStyle]}>
          <Text style={styles.checkText}>✓</Text>
        </Animated.View>
      </Animated.View>
      <Text style={styles.splashTitle}>
        Task<Text style={styles.splashHighlight}>Hub</Text>
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <AnimatedSplash />;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            animationDuration: 250,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(public)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(worker)" />
          <Stack.Screen name="(buyer)" />
          <Stack.Screen name="(admin)" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9E5",
    gap: 16,
  },
  logoHex: {
    width: 72,
    height: 72,
    backgroundColor: "#004030",
    transform: [{ rotate: "45deg" }],
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#004030",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 12,
  },
  hexInner: {
    transform: [{ rotate: "-45deg" }],
  },
  logoTShape: {
    alignItems: "center",
    gap: 2,
  },
  logoBar: {
    width: 24,
    height: 4,
    backgroundColor: "#FFF9E5",
    borderRadius: 2,
  },
  logoStem: {
    width: 4,
    height: 16,
    backgroundColor: "#FFF9E5",
    borderRadius: 2,
  },
  checkDot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#4A9782",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4A9782",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  splashTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#004030",
    letterSpacing: -0.5,
  },
  splashHighlight: {
    color: "#4A9782",
  },
});
