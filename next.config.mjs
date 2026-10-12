/** @type {import('next').NextConfig} */
const nextConfig = { poweredByHeader: false, experimental: { serverComponentsExternalPackages: ['typeorm', 'mysql2'] } };
export default nextConfig;
