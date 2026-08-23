import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow cross-origin images from trusted sources for scraping demos
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.loomsolar.com" },
      { protocol: "https", hostname: "cdn.loomsolar.com" },
    ],
  },
  // Transpile @xyflow packages for Next.js compatibility
  transpilePackages: ["@xyflow/react", "@xyflow/system"],
};

export default nextConfig;
