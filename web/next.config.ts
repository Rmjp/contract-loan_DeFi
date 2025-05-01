import type { NextConfig } from "next";
import type { Configuration } from "webpack";

const nextConfig: NextConfig = {
  webpack: (config: Configuration) => {
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...config.resolve?.fallback,
        net: false,
        tls: false,
        fs: false,
        crypto: false,
        bufferutil: false,
        'utf-8-validate': false,
        'pino-pretty': false,
      },
    };
    return config;
  },
};

export default nextConfig;
