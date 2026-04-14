// auto-deploy: deploy-1775103223
const nextConfig = {
  // Disable Partial Pre-Rendering globally — admin panel must never be statically cached
  experimental: {
    ppr: false,
  },
  // Required for @imgly/background-removal WASM model files
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    // Allow WASM files
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'yivfsicvaoewxrtkrfxr.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.touchmemories.ua',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  async redirects() {
    return [
      {
        source: '/constructor',
        destination: '/constructor/photobook',
        permanent: false,
      },
      {
        source: '/contacts',
        destination: '/kontakty',
        permanent: true,
      },
      {
        source: '/about',
        destination: '/',
        permanent: false,
      },
      {
        source: '/delivery',
        destination: '/',
        permanent: false,
      },
    ];
  },
}

export default nextConfig
