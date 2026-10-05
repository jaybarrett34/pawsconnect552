import type { NextConfig } from "next";

// FastAPI serves /api/*: uvicorn on :8000 locally, the api/index.py serverless function on Vercel.
const nextConfig: NextConfig = {
  rewrites: async () => [
    {
      source: "/api/:path*",
      destination: process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000/api/:path*" : "/api/",
    },
  ],
  images: { unoptimized: true },
  // Security headers (clickjacking, MIME sniffing, referrer leakage, unused device APIs).
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      ],
    },
  ],
};

export default nextConfig;
