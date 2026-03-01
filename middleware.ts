import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_DURATION = 60 * 60 * 24 // 24 hours in seconds

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            maxAge: SESSION_DURATION, // 24 hours
            sameSite: 'lax' as const,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          }

          req.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value,
            ...cookieOptions,
          })
        },
        remove(name: string, options: CookieOptions) {
          const cookieOptions = {
            ...options,
            maxAge: 0,
            path: '/',
          }

          req.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          })
          res.cookies.set({
            name,
            value: '',
            ...cookieOptions,
          })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  const protectedPaths = ['/shop', '/cart', '/submit', '/admin', '/cashier', '/gallery']
  const isProtectedPath = protectedPaths.some(path => 
    req.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (req.nextUrl.pathname.startsWith('/admin') && profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/shop', req.url))
    }

    if (req.nextUrl.pathname.startsWith('/cashier') && 
        !['cashier', 'admin'].includes(profile?.role || '')) {
      return NextResponse.redirect(new URL('/shop', req.url))
    }
  }

  return res
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}