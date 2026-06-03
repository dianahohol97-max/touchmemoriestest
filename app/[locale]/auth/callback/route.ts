export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { }
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Exchange error:', error)
    }
  }

  // Redirect to the localized account page. A bare "/account" 404s because the
  // route only exists under [locale]; derive the locale from the callback path.
  const LOCALES = ['uk', 'en', 'ro', 'pl', 'de']
  const seg = requestUrl.pathname.split('/')[1] || ''
  const locale = LOCALES.includes(seg) ? seg : 'uk'
  return NextResponse.redirect(new URL(`/${locale}/account`, request.url))
}
