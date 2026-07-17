import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { getUserData } from "../../src/lib/storage";
import Spinner from "../../src/components/ui/Spinner";

export default function AdminLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await getUserData();
      if (!raw) {
        router.replace("/(auth)/login");
        return;
      }
      const user = JSON.parse(raw);
      if (user.role !== "admin") {
        router.replace(
          user.role === "worker"
            ? "/(worker)/dashboard"
            : "/(buyer)/dashboard",
        );
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <Spinner />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="users" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="submissions" />
      <Stack.Screen name="withdrawals" />
      <Stack.Screen name="payments" />
      <Stack.Screen name="stats" />
      <Stack.Screen name="categories" />
      <Stack.Screen name="activity" />
    </Stack>
  );
}
