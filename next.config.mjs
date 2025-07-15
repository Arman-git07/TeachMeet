// next.config.mjs
import { withGenkit } from '@genkit-ai/next';

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
};

export default withGenkit(nextConfig);
