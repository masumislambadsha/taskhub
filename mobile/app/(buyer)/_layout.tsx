import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { getUserData } from "../../src/lib/storage";
import Spinner from "../../src/components/ui/Spinner";

export default function BuyerLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await getUserData();
      if (!raw) {
        router.replace("/(auth)/login");
        return;
      }
      const user = JSON.parse(raw);
      if (user.role !== "buyer") {
        router.replace(user.role === "worker" ? "/(worker)/dashboard" : "/(auth)/login");
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <Spinner />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="submissions" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="coins" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
