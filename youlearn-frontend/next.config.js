/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Add fallbacks for browser modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
      fs: false,
      path: false,
      url: false,
      util: false,
    };
    
    // Optimize PDF.js chunks
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        ...config.optimization.splitChunks,
        chunks: 'all',
        minSize: 20000,
        maxSize: 100000,
      },
    };
    
    // Increase memory limit for processing large files
    config.performance = {
      ...config.performance,
      maxAssetSize: 500000,
      maxEntrypointSize: 500000,
      hints: 'warning',
    };
    
    return config;
  },
};

module.exports = nextConfig;