import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  typescript: {
    ignoreBuildErrors: true
  },
  eslint: {
    // Matches the typescript setting above: `next build` shouldn't fail a
    // Docker image build over lint findings that don't block `next dev`.
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
