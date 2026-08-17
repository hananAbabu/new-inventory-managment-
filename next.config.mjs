/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Nothing here uses next/image, so skip the sharp/libvips pipeline entirely.
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: 'image.qwenlm.ai' }],
  },
  experimental: {
    // This machine has little free memory; one build worker keeps it in bounds.
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
