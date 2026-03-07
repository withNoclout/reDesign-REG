import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: './',
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'reg.kmutnb.ac.th',
      },
      {
        protocol: 'https',
        hostname: 'reg3.kmutnb.ac.th',
      },
      {
        protocol: 'https',
        hostname: 'reg4.kmutnb.ac.th',
      },
      {
        protocol: 'https',
        hostname: 'tqbzejjswyexfyvtluup.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://reg.kmutnb.ac.th https://reg3.kmutnb.ac.th https://reg4.kmutnb.ac.th https://tqbzejjswyexfyvtluup.supabase.co; font-src 'self'; connect-src 'self' https://tqbzejjswyexfyvtluup.supabase.co; frame-ancestors 'none'; upgrade-insecure-requests;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
