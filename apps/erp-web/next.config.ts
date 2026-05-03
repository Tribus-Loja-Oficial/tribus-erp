import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tribus-erp/core"],
  experimental: {
    typedRoutes: false,
  },
  /**
   * Next.js limitava por defeito o corpo das Server Actions a ~1 MB (falhas opacas em ficheiros ~1,5 MB).
   * Uploads de imagem passam por `POST /api/products/media-upload` (Route Handler); este limite cobre outras actions com payloads grandes.
   */
  serverActions: {
    bodySizeLimit: "6mb",
  },
};

export default nextConfig;
