import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { getToken, getUserData } from "../src/lib/storage";

export default function Index() {
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = await getToken();
    if (!token) {
      router.replace("/(public)");
      return;
    }

    try {
      const userStr = await getUserData();
      if (!userStr) {
        router.replace("/(public)");
        return;
      }

      const user = JSON.parse(userStr);
      const role = user.role;

      if (role === "worker") router.replace("/(worker)/dashboard");
      else if (role === "buyer") router.replace("/(buyer)/dashboard");
      else if (role === "admin") router.replace("/(admin)/dashboard");
      else router.replace("/(public)");
    } catch {
      router.replace("/(public)");
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="#004030" />
    </View>
  );
}
