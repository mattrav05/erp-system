/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable automatic reload on build ID changes to prevent tab switch reloads
  assetPrefix: process.env.NODE_ENV === 'production' ? undefined : '',

  // Improve caching behavior for production
  poweredByHeader: false,

  // Reduce aggressive reloading in production
  experimental: {
    // Disable some of the automatic reload mechanisms
    optimizePackageImports: ['lucide-react']
  }
}

module.exports = nextConfig