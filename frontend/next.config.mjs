/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow frontend to call backend on any host (E2B previews use dynamic hostnames)
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
  // Disable strict origin checks for preview iframe
  experimental: {
    // Needed for .e2b.app preview proxy
  },
};

export default nextConfig;
