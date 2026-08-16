/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow importing TypeScript source directly from the shared workspace
  // package without a separate build step for it.
  transpilePackages: ["@co-op-games/shared"],
  webpack: (config) => {
    // The shared package's NodeNext-style source uses explicit ".js"
    // specifiers that actually resolve to ".ts" files (needed for tsx/node
    // to run it directly) — teach webpack to resolve those the same way.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".js", ".ts", ".tsx"],
    };
    return config;
  },
};

export default nextConfig;
