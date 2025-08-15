// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   experimental: {
//     serverActions: true,
//     serverComponentsExternalPackages: ['mongoose']
//   },
//   images: {
//     domains: ['m.media-amazon.com']
//   }
// }

// module.exports = nextConfig
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {}, 
  },
  serverExternalPackages: ['mongoose'],
  images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'm.media-amazon.com',
      port: '', // optional
      pathname: '**', // optional wildcard match
    },
  ],
}

};

module.exports = nextConfig;
