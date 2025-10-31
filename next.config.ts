import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: { appDir: true },
  images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] }
};
export default nextConfig;
