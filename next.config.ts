import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server build for a small production Docker image.
  output: "standalone",
  experimental: {
    // Server Actions receive multipart uploads (photos); raise the body limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
