import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const manrope = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "TaskHub | Premium Micro-Task Marketplace",
  description:
    "Earn from micro tasks or get work done faster. The premium marketplace for precise execution.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "TaskHub | Premium Micro-Task Marketplace",
    description:
      "Connect with thousands of workers and buyers in a curated ecosystem.",
    type: "website",
    images: [{ url: "/logo.svg" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable}`}>
      <head></head>
      <body
        className="min-h-screen bg-background text-on-background antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
