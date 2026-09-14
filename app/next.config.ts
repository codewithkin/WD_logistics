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
  },
  // Allow <Image>/next/image to render files served from Cloudflare R2's
  // public r2.dev URL (R2_PUBLIC_URL / uploads — see src/lib/r2.ts).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-0ff595dc3a53401c89c83bcaa812f92c.r2.dev",
      },
    ],
  }
};

export default nextConfig;
