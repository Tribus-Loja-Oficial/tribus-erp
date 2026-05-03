import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tribus-erp/core"],
  experimental: {
    typedRoutes: false,
  },
  /** Default ~1 MB bloqueia uploads de mídia via Server Action (multipart). API aceita até 5 MB. */
  serverActions: {
    bodySizeLimit: "6mb",
  },
};

export default nextConfig;
