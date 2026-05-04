/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true,
  },
  async rewrites() {
    return [
      {
        source: '/openai-api/:path*',
        destination: 'https://s2a.shuai.help/v1/:path*',
      },
      {
        source: '/gemini-api/:path*',
        destination: 'https://s2a.shuai.help/v1/:path*',
      },
      {
        source: '/nvidia-api/:path*',
        destination: 'https://integrate.api.nvidia.com/v1/:path*',
      },
      {
        source: '/grok-api/:path*',
        destination: 'http://43.155.204.215:18000/v1/:path*',
      },
    ]
  },
}

export default nextConfig
