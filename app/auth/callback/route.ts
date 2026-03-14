import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    if (code) {
        const cookieStore = await cookies()
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (!exchangeError && session?.user) {
            const user = session.user

            // Auto-create customer record (Item 7)
            const { data: customer } = await supabase
                .from('customers')
                .select('id')
                .eq('email', user.email)
                .single()

            if (!customer) {
                const metadata = user.user_metadata
                // Google provides full_name, given_name, family_name, picture
                const firstName = metadata.given_name || metadata.full_name?.split(' ')[0] || ''
                const lastName = metadata.family_name || metadata.full_name?.split(' ').slice(1).join(' ') || ''
                const avatarUrl = metadata.avatar_url || metadata.picture || ''

                await supabase.from('customers').insert({
                    email: user.email,
                    first_name: firstName,
                    last_name: lastName,
                    avatar_url: avatarUrl,
                    auth_user_id: user.id,
                    email_subscribed: false, // Default to false unless we capture it later
                    created_at: new Date().toISOString()
                })
            } else {
                // Update last login
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
