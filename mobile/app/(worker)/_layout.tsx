import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { getUserData } from "../../src/lib/storage";
import Spinner from "../../src/components/ui/Spinner";

export default function WorkerLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    checkRole();
  }, []);

  async function checkRole() {
    try {
      const userStr = await getUserData();
      if (!userStr) {
        router.replace("/(auth)/login");
        return;
      }
      const user = JSON.parse(userStr);
      if (user.role !== "worker") {
        router.replace("/(auth)/login");
        return;
      }
    } catch {
      router.replace("/(auth)/login");
      return;
    }
    setReady(true);
  }

  if (!ready) return <Spinner />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="submissions" />
      <Stack.Screen name="earnings" />
      <Stack.Screen name="withdrawals" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="profile" />
    </Stack>
  );
}
