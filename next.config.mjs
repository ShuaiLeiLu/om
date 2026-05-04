/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:3001'
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`
      }
    ]
  }
}

export default nextConfig
