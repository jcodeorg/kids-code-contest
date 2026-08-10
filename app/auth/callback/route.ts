import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const inviteToken = requestUrl.searchParams.get('token')

  if (!code) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(new URL('/auth/signin', request.url))
  }

  try {
    const body: any = {
      name: user.user_metadata?.name || user.user_metadata?.full_name || user.email.split('@')[0],
      email: user.email,
      authProvider: 'google',
    }
    if (inviteToken) body.inviteToken = inviteToken

    await fetch(new URL('/api/register', request.url), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
  } catch {
    // keep sign-in flow successful even if profile sync fails temporarily
  }

  // Resolve role for direct dashboard redirect.
  let role = 'applicant'
  try {
    const { data: profile } = await supabase.from('users').select('role').eq('email', user.email).single()
    role = profile?.role || 'applicant'
  } catch {
    role = 'applicant'
  }

  const redirectResponse = NextResponse.redirect(new URL(`/${role}`, request.url))
  // Preserve auth cookies set during exchangeCodeForSession.
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie)
  })
  return redirectResponse
}
