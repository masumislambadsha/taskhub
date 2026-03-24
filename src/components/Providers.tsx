"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/store";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import SmoothScroll from "./SmoothScroll";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <SessionProvider>
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <SmoothScroll>{children}</SmoothScroll>

          <Toaster
            position="bottom-center"
            toastOptions={{
              style: {
                background: "#004030",
                color: "#FFF9E5",
                borderRadius: "8px",
              },
              success: {
                iconTheme: { primary: "#4A9782", secondary: "#FFF9E5" },
              },
            }}
          />
        </QueryClientProvider>
      </ReduxProvider>
    </SessionProvider>
  );
}
