import { useState, useCallback, useEffect, useRef } from "react";
import type { EmitterSubscription } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { setToken, setUserData } from "../lib/storage";
import { API_BASE_URL } from "../lib/constants";

interface GoogleAuthUser {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role: "worker" | "buyer" | "admin";
  coins: number;
}

export function useGoogleAuth(onError?: (msg: string) => void) {
  const [loading, setLoading] = useState(false);
  const subRef = useRef<EmitterSubscription | null>(null);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);

    const authUrl = `${API_BASE_URL}/auth/mobile-google`;

    const sub: EmitterSubscription = Linking.addEventListener("url", (event) => {
      const { queryParams } = Linking.parse(event.url);
      const token = queryParams?.token as string | undefined;
      const userParam = queryParams?.user as string | undefined;

      if (token && userParam) {
        try {
          const user: GoogleAuthUser = JSON.parse(decodeURIComponent(userParam));
          setToken(token);
          setUserData(JSON.stringify(user));

          const role = user.role;
          if (role === "worker") router.replace("/(worker)/dashboard");
          else if (role === "buyer") router.replace("/(buyer)/dashboard");
          else router.replace("/(admin)/dashboard");
        } catch {
          onError?.("Failed to process authentication response");
        }
      } else {
        onError?.("Authentication failed");
      }

      setLoading(false);
    });

    subRef.current = sub;
    await Linking.openURL(authUrl);
  }, [onError]);

  useEffect(() => {
    return () => {
      subRef.current?.remove();
    };
  }, []);

  return { signInWithGoogle, loading };
}
