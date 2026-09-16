import type { NextConfig } from "next";

// next/image's remotePatterns are baked in at BUILD time, not read from
// runtime env — so R2_PUBLIC_URL must be passed as a Docker build ARG (see
// app/Dockerfile), not just a runtime environment variable, or this ends up
// empty in the built image and uploaded images silently fail to render.
const r2PublicHostname = (() => {
  try {
    return process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL).hostname : null;
  } catch {
    return null;
  }
})();

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
  // public URL (R2_PUBLIC_URL — see src/lib/r2.ts). Derived from the env var
  // so a different bucket/custom domain doesn't need a code change — falls
  // back to the original dev bucket's hostname if the build arg is missing.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: r2PublicHostname || "pub-0ff595dc3a53401c89c83bcaa812f92c.r2.dev",
      },
    ],
  }
};

export default nextConfig;
