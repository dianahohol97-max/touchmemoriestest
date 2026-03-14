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
                        } catch {
                            // The `setAll` method was called from a Server Component.
                            // This can be ignored if you have middleware refreshing
                            // user sessions.
                        }
                    },
                },
            }
        )

        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!exchangeError && session?.user) {
            const user = session.user

            // Auto-create/sync customer record
            const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('email', user.email)
                .single()

            if (!customer) {
                const metadata = user.user_metadata
                const firstName = metadata.given_name || metadata.full_name?.split(' ')[0] || ''
                const lastName = metadata.family_name || metadata.full_name?.split(' ').slice(1).join(' ') || ''
                const avatarUrl = metadata.picture || metadata.avatar_url || ''

                await supabase.from('customers').insert({
                    email: user.email,
                    first_name: firstName,
                    last_name: lastName,
                    avatar_url: avatarUrl,
                    auth_user_id: user.id,
                    email_subscribed: false,
                    created_at: new Date().toISOString(),
                    last_login_at: new Date().toISOString()
                })
            } else {
                await supabase.from('customers').update({
                    last_login_at: new Date().toISOString()
                }).eq('id', customer.id)
            }
        }
    }

    return NextResponse.redirect(
        new URL('/account', request.url)
    )
}
