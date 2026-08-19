/** @type {import('next').NextConfig} */

// This laptop has little free memory and dies mid-build with parallel workers.
// Vercel's builders do not, and serialising there would only make builds slower.
const lowMemoryLocalBuild = !process.env.VERCEL;

const nextConfig = {
  reactStrictMode: true,
  images: {
    // Nothing here uses next/image, so skip the sharp/libvips pipeline entirely.
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'image.qwenlm.ai' }],
  },
  ...(lowMemoryLocalBuild ? { experimental: { cpus: 1, workerThreads: false } } : {}),
};

export default nextConfig;
