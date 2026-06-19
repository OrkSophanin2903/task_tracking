import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'
import { appendResponseHeader } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/supabase'

/**
 * Typed Supabase client, pointed at the project from runtimeConfig
 * (NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_KEY).
 *
 * Session is stored in cookies (via @supabase/ssr) rather than localStorage, so
 * SSR `useAsyncData` calls run authenticated — mirrors the old `useApiClient`'s
 * cookie-based JWT. On the server we read/write cookies on the current request;
 * on the client the browser client manages `document.cookie` directly.
 */
export function useSupabase(): SupabaseClient<Database> {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl
  const key = config.public.supabaseKey

  if (import.meta.server) {
    const event = useRequestEvent()!
    return createServerClient<Database>(url, key, {
      cookies: {
        getAll() {
          return parseCookieHeader(event.headers.get('cookie') ?? '')
            .filter((c) => c.value !== undefined) as { name: string; value: string }[]
        },
        setAll(cookies) {
          for (const { name, value, options } of cookies) {
            appendResponseHeader(
              event,
              'set-cookie',
              serializeCookieHeader(name, value, options),
            )
          }
        },
      },
    })
  }

  // Browser: one client per page load.
  browserClient ??= createBrowserClient<Database>(url, key)
  return browserClient
}

let browserClient: SupabaseClient<Database> | undefined
