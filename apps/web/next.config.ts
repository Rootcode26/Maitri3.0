import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be used from other devices (e.g. over Tailscale or
  // the LAN). Next blocks cross-origin dev requests by default, which breaks
  // client-side behaviour (like showing form errors) for remote viewers.
  // Add each sharing hostname/IP here (hostname only — no scheme or port).
  allowedDevOrigins: ["100.68.65.0", "192.168.0.109"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
