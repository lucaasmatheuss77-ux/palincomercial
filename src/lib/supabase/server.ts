import 'server-only'
import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (e) {
            // Em Server Components o cookie store é read-only — ignorar é esperado.
            // Em Route Handlers e Server Actions isso não deveria ocorrer.
            if (process.env.NODE_ENV === 'development') {
              console.warn('[supabase/server] setAll ignorado (read-only context):', e)
            }
          }
        },
      },
    }
  )
}
