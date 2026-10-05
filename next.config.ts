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
};

export default nextConfig;
