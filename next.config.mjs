/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const defaultApiInternalUrl =
      process.env.NODE_ENV === "development"
        ? "http://localhost:5004"
        : "http://api:8080"
    const apiInternalUrl = process.env.API_INTERNAL_URL || defaultApiInternalUrl
    return [
      {
        source: "/api/:path*",
        destination: `${apiInternalUrl}/api/:path*`,
      },
      {
        source: "/files/:path*",
        destination: `${apiInternalUrl}/api/LearningStorage/download/:path*`,
      },
    ]
  },
}

export default nextConfig
