/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "upgrade-insecure-requests"
          }
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/chat',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
