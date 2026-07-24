/** @type {import('next').NextConfig} */

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` for styles is required by Tailwind's runtime style injection,
 * and `'unsafe-eval'` is dev-only (React Refresh). Scripts otherwise stay
 * same-origin. `frame-src blob: https:` is needed so the Supabase signed-URL PDF
 * renders in the viewer iframe.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  // Supabase REST/Realtime/Storage endpoints.
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' blob: https://*.supabase.co",
  "object-src 'none'",
  "base-uri 'self'",
  // Blocks <form action="https://evil.example"> injected into any page.
  "form-action 'self'",
  // Modern equivalent of X-Frame-Options: DENY.
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Clickjacking defence for browsers predating frame-ancestors.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Signed PDF URLs must not leak into third-party referer headers.
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  // pdf-parse bundles its own pdf.js and uses dynamic requires — keep it external
  // so it's required at runtime from node_modules instead of being bundled.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // API responses are per-user and must never be stored by a shared cache.
      {
        source: '/api/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0, must-revalidate' }],
      },
    ]
  },
}

export default nextConfig
