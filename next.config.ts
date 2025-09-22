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
  },
};

// Incrementing this comment to force a cache clear: 5
module.exports = nextConfig;
