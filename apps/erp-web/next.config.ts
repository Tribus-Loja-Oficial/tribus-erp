import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tribus-erp/core"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
