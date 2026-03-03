import withPWA from 'next-pwa';

const isProduction = process.env.NODE_ENV === 'production';

const pwaConfig = withPWA({
  dest: 'public',
  disable: !isProduction,
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        // Fixes npm packages that depend on `fs` module
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                path: false,
                crypto: false,
            };
        }

        return config;
    },
    serverExternalPackages: ['onnxruntime-node'],
};

export default pwaConfig(nextConfig);