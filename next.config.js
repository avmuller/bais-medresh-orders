// next.config.js (CommonJS)
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "tnoetlmadesyezceyzel.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};
module.exports = nextConfig;
