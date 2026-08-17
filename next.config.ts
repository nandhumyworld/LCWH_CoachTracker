import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emit a self-contained server build for a small production Docker image.
  output: "standalone",
  // Pin the file-tracing root to this project so a stray lockfile elsewhere
  // (e.g. in the home dir) can't mislead standalone output tracing.
  outputFileTracingRoot: path.join(__dirname),
  experimental: {
    // Server Actions receive multipart uploads (photos); raise the body limit.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
