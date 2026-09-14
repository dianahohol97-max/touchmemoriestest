export const dynamic = 'force-dynamic'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { localeFromPath, safeNextPath } from '@/lib/auth/oauth-callback-url'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  // Everything between here and the redirect is wrapped, including the
  // exchange itself. This route is now the front door of every sign-in on the
  // site, and a throw here would show an error page to someone who has
  // already typed their password correctly. A failed exchange leaves them at
  // the account page without a session, which the page handles by asking them
  // to sign in — annoying, and still far better than a 500.
  if (code) try {
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
    const { data: exchanged, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Exchange error:', error)
    }

    // Гостьові замовлення цієї пошти — до акаунта.
    //
    // Прив'язка стоїть САМЕ ТУТ, і це другий підхід до снаряда. Спершу я вставив
    // її в /api/auth/register — і вона не спрацювала жодного разу, бо той
    // маршрут не викликає ніхто: обидві форми йдуть напряму в
    // supabase.auth.signUp, а картку клієнта створює тригер у базі.
    //
    // Чому не тригер. Правило зіставлення імен живе в TypeScript
    // (lib/customers/name-match.ts) і має там тести на 50 справжніх пар.
    // Переписати транслітерацію і вимогу двох збігів на PL/pgSQL означало б
    // завести ДРУГУ копію правила — рівно те, через що вже розійшлися дві копії
    // правила «оплачено повністю» і їх довелося зшивати тестом.
    //
    // Чому саме callback. Через нього проходять усі: і підтвердження пошти, і
    // Google. Він серверний, тож не залежить від того, чи згадає про виклик
    // автор наступної форми входу. Людина, яка зареєструвалася і не
    // підтвердила пошту, сюди не дійде — але вона і в кабінет не потрапить,
    // тож показувати їй нема чого.
    //
    // Повторний клік по тому самому листу нічого не зламає: прив'язка чіпає
    // лише замовлення з порожнім customer_id.
    const user = exchanged?.user
    if (user?.id) {
      try {
        const { getAdminClient } = await import('@/lib/supabase/admin')
        const { linkGuestOrdersForCustomer } = await import('@/lib/customers/link-guest-orders')
        const admin = getAdminClient()
        const { data: customer } = await admin
          .from('customers')
          .select('id, email, name, phone, birthday')
          .or(`auth_user_id.eq.${user.id},id.eq.${user.id}`)
          .maybeSingle()

        // Те, що людина ввела при реєстрації, але тригер не переніс.
        //
        // handle_new_auth_user бере лише COALESCE(meta->>'name',
        // meta->>'full_name'). Дату народження він не читає взагалі, тож із 35
        // введених дат у customers не було жодної, і крон привітань працював
        // на порожньому місці. Писала їх тільки /api/auth/register, який ніхто
        // не викликав і який цим же комітом видалено.
        //
        // Тут же самозагоюється і друга діра тригера: гілка, яка при наявному
        // рядку з такою поштою прив'язує auth_user_id і ім'я не чіпає.
        //
        // Заповнене НЕ перезаписується: людина могла виправити ім'я в
        // кабінеті, і метадані з моменту реєстрації не мають права це
        // відкотити.
        if (customer?.id) {
          try {
            const { profilePatchFromMetadata } = await import('@/lib/customers/profile-from-metadata')
            const patch = profilePatchFromMetadata(customer, user.user_metadata)
            if (Object.keys(patch).length > 0) {
              await admin.from('customers').update(patch).eq('id', customer.id)
              console.log('[auth/callback] profile filled from metadata', { userId: user.id, fields: Object.keys(patch) })
            }
          } catch (e) {
            console.error('Filling profile from metadata failed (sign-in still succeeded):', e)
          }
        }

        if (customer?.id) {
          const res = await linkGuestOrdersForCustomer(admin, customer)
          if (res.linked || res.review) {
            console.log('[auth/callback] guest orders', { userId: user.id, ...res })
          }
        }
      } catch (e) {
        // Вхід важливіший за прив'язку. Непов'язане замовлення полагодить
        // менеджер зі списку в адмінці, а людину, яку не пустили в кабінет,
        // не полагодить ніхто.
        console.error('Linking guest orders failed (sign-in still succeeded):', e)
      }
    }
  } catch (e) {
    console.error('[auth/callback] failed before redirect:', e)
  }

  // Where to put the person down.
  //
  // The default is the localized account page — a bare "/account" 404s
  // because the route only exists under [locale].
  //
  // `next` overrides it, and it is what keeps the sign-in modal honest: it
  // opens on top of the constructor or a product card so the person can carry
  // on with what they were doing, and the account page would read as a lost
  // action. Only a relative path of this site is accepted; `//evil.com` and
  // `https://evil.com` are read by the browser as somewhere else entirely,
  // and an open redirect is worth more to a phisher precisely because it
  // starts on a domain the person just trusted with a password.
  //
  // This runs whatever happened above. An exchange that failed, a database
  // that was unreachable, a person clicking a stale link twice — all of them
  // end here with a redirect rather than an error page, because the sign-in
  // matters more than anything this route adds to it.
  const locale = localeFromPath(requestUrl.pathname)
  const next = safeNextPath(requestUrl.searchParams.get('next'))
  return NextResponse.redirect(new URL(next || `/${locale}/account`, request.url))
}
