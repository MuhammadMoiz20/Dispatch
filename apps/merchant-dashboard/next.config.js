/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/graphql';
    const rulesBase = process.env.NEXT_PUBLIC_RULES_BASE || 'http://localhost:14004';
    const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_URL || 'http://localhost:14005';
    const toOrigin = (url) => {
      try {
        const u = new URL(url.startsWith('http') ? url : `http://${url}`);
        return `${u.protocol}//${u.host}`;
      } catch {
        return null;
      }
    };
    const origins = [
      toOrigin(apiUrl),
      toOrigin(apiUrl.replace('http', 'ws')),
      toOrigin(rulesBase),
      toOrigin(shopifyUrl),
    ].filter(Boolean);
    const connectSrc = ["'self'", ...new Set(origins)].join(' ');

    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = ["'self'", isDev ? "'unsafe-eval'" : null].filter(Boolean).join(' ');
    const fontSrc = ["'self'", 'data:', isDev ? 'https://r2cdn.perplexity.ai' : null]
      .filter(Boolean)
      .join(' ');
    const csp = [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      `font-src ${fontSrc}`,
      `script-src ${scriptSrc}`,
      `connect-src ${connectSrc}`,
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
