/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.pokemontcg.io' },
      { protocol: 'https', hostname: 'tcgplayer-cdn.tcgplayer.com' },
      { protocol: 'https', hostname: 'product-images.tcgplayer.com' },
    ],
  },
};

export default nextConfig;
