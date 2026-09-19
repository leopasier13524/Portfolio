import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Allow Playwright/tools that hit 127.0.0.1 while `next dev` binds as localhost.
     Without this, Next 16 blocks /_next webpack-hmr and the client never hydrates —
     Skip/Esc/intro timeout look broken (LOADING stuck at 000). */
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
};

export default nextConfig;
