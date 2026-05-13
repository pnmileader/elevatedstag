import type { NextConfig } from "next";

// Content-Security-Policy.
//
// Notes on choices:
//   - script-src includes 'unsafe-inline' because Next 16 App Router emits
//     inline bootstrap script tags. A nonce-based CSP needs middleware to
//     stamp every response with a fresh nonce — tracked as a follow-up
//     hardening item in SECURITY_AUDIT.md.
//   - connect-src must include Supabase (REST + realtime websocket) and the
//     Resend transactional email API.
//   - img-src allows the Supabase storage CDN (stored client photos /
//     swatches), data: for inline favicons, blob: for client-side previews.
//   - style-src includes 'unsafe-inline' for inline style attributes used
//     extensively in the design-system rows + Google Fonts stylesheet.
//   - frame-ancestors 'none' pairs with X-Frame-Options DENY.

const SUPABASE_HOSTS = [
  'https://*.supabase.co',
  'https://*.supabase.in',
  'wss://*.supabase.co',
]

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: ${SUPABASE_HOSTS.join(' ')}`,
  `connect-src 'self' ${SUPABASE_HOSTS.join(' ')} https://api.resend.com`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
].join('; ')

const nextConfig: NextConfig = {
  // Drop the "x-powered-by: Next.js" header — minor info-disclosure.
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // HSTS with preload (eligible to submit to hstspreload.org once stable).
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
