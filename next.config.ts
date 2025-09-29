/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js configuration options can go here.
  // For example, to add a new hostname for images:
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: 'example.com',
  //       port: '',
  //       pathname: '/images/**',
  //     },
  //   ],
  // },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    fontLoaders: [
      { loader: '@next/font/google', options: { subsets: ['latin'] } },
    ],
  },
};

// Incrementing this comment to force a cache clear: 9
module.exports = nextConfig;
