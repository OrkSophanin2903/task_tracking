// Liveness/readiness probe for the container orchestrator (Coolify's
// healthcheck + the Dockerfile HEALTHCHECK both hit this).
//
// Deliberately a Nitro server route, NOT a Vue page: it bypasses the global
// auth middleware and never constructs a Supabase client, so it returns 200
// even before/without auth and regardless of the NUXT_PUBLIC_SUPABASE_* env.
// Probing `/` instead would run full SSR (auth redirect + Supabase) and can
// 500, which would wrongly mark a healthy container as down.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return { status: 'ok' }
})
