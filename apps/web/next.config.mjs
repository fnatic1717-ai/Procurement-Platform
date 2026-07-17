import process from 'node:process';
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@procurement/ui'],
  async rewrites() {
    const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';
    return [{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }];
  },
};
export default nextConfig;
