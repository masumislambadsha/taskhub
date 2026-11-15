import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Docker builds set BUILD_STANDALONE=1; Vercel builds leave it unset.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
  // pino is loaded from node_modules at runtime instead of being bundled.
  serverExternalPackages: ["pino"],
  // Hand the browser bundle the Sentry settings it cannot read from the server
  // environment. Empty strings mean "not set".
  env: {
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT ?? "",
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:
      process.env.SENTRY_TRACES_SAMPLE_RATE ?? "",
    NEXT_PUBLIC_GIT_SHA:
      process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.ibb.co",
      },
      {
        protocol: "https",
        hostname: "ibb.co",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },
  compiler: {
    styledComponents: true,
  },
};

// Source maps are uploaded to Sentry only when SENTRY_AUTH_TOKEN is set. With
// no token the build makes no Sentry network calls and cannot fail on Sentry.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: { disable: !uploadSourceMaps },
  release: {
    name: process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    create: uploadSourceMaps,
    finalize: uploadSourceMaps,
  },
});
