import { useEffect, useCallback } from "react";
import { router } from "expo-router";
import { getToken, getUserData } from "../src/lib/storage";
import Spinner from "../src/components/ui/Spinner";

export default function Index() {
  const checkAuth = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  return <Spinner variant="hub" size="xl" message="Loading TaskHub..." />;
}
