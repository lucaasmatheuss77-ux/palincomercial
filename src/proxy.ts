import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|BlackBerry|IEMobile|Opera Mini/i

function isMobileDevice(request: NextRequest): boolean {
  const ua = request.headers.get('user-agent') ?? ''
  return MOBILE_UA.test(ua)
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  type CookieToSet = {
    name: string
    value: string
    options?: Parameters<typeof supabaseResponse.cookies.set>[2]
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path    = request.nextUrl.pathname
  const mobile  = isMobileDevice(request)

  // ── Rotas protegidas sem autenticação → login ──────────────────────────────
  if ((path.startsWith('/dashboard') || path.startsWith('/mobile')) && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', mobile ? '/mobile' : path)
    return NextResponse.redirect(loginUrl)
  }

  // ── APIs sem autenticação → 401 ────────────────────────────────────────────
  if (path.startsWith('/api/') && !user) {
    return NextResponse.json({ error: 'Nao autorizado.' }, { status: 401 })
  }

  // ── Usuário logado na raiz → redireciona conforme dispositivo ──────────────
  if (path === '/' && user) {
    return NextResponse.redirect(new URL(mobile ? '/mobile' : '/dashboard', request.url))
  }

  // ── Usuário logado no /login → redireciona conforme dispositivo ────────────
  if (path === '/login' && user) {
    const redirectTo = request.nextUrl.searchParams.get('redirectTo')
    const dest = redirectTo ?? (mobile ? '/mobile' : '/dashboard')
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // ── Celular acessando /dashboard → manda para /mobile ─────────────────────
  if (mobile && path === '/dashboard' && user) {
    return NextResponse.redirect(new URL('/mobile', request.url))
  }

  // ── Desktop acessando /mobile → manda para /dashboard ─────────────────────
  if (!mobile && path === '/mobile' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
