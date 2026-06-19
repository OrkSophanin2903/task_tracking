// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/color-mode'],
  // Self-hosted variable fonts (offline-friendly) + design tokens.
  css: [
    '@fontsource-variable/geist',
    '@fontsource-variable/geist-mono',
    '~/assets/css/main.css',
  ],
  colorMode: {
    classSuffix: '', // adds `.light` / `.dark` on <html> (no `-mode` suffix)
    preference: 'system', // default to OS, user can toggle
    fallback: 'light',
    storageKey: 'tasktracker-theme',
  },
  runtimeConfig: {
    public: {
      // Supabase project URL + anon (publishable) key — safe to ship to the
      // browser, RLS is what protects the data. Set in `.env` as
      // NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY.
      supabaseUrl: '',
      supabaseKey: '',
    },
  },
  // Security headers — applied to every response in production only, so dev
  // HMR (vite ws) and Nuxt devtools aren't blocked by the CSP. The CSP allows
  // self-hosted assets + connections to Supabase; script/style keep
  // 'unsafe-inline' because Nuxt's SSR hydration injects inline scripts and
  // scoped styles (no 'unsafe-eval' — the prod build needs none). For
  // nonce-based hardening later, adopt the `nuxt-security` module.
  $production: {
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "object-src 'none'",
          ].join('; '),
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          'Strict-Transport-Security':
            'max-age=63072000; includeSubDomains; preload',
        },
      },
    },
  },
})
