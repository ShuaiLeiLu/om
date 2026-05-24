function normalizeApiBase(raw) {
  const base = (raw || 'http://127.0.0.1:3001').replace(/\/+$/, '')
  return base.endsWith('/api') ? base.slice(0, -4) : base
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async rewrites() {
    const apiBase = normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL)
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`
      }
    ]
  }
}

export default nextConfig
