import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module, must run on server only
  serverExternalPackages: ['better-sqlite3'],

  // Allow images from common rental listing platforms
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.craigslist.org' },
      { protocol: 'https', hostname: '*.zillowstatic.com' },
      { protocol: 'https', hostname: 'photos.zillowstatic.com' },
      { protocol: 'https', hostname: '*.apartments.com' },
      { protocol: 'https', hostname: '*.hotpads.com' },
      { protocol: 'https', hostname: '*.padmapper.com' },
      { protocol: 'https', hostname: 'images1.apartments.com' },
      { protocol: 'https', hostname: 'images2.apartments.com' },
    ],
  },
};

export default nextConfig;
