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
  }

  // Redirect to the localized account page. A bare "/account" 404s because the
  // route only exists under [locale]; derive the locale from the callback path.
  const LOCALES = ['uk', 'en', 'ro', 'pl', 'de']
  const seg = requestUrl.pathname.split('/')[1] || ''
  const locale = LOCALES.includes(seg) ? seg : 'uk'
  return NextResponse.redirect(new URL(`/${locale}/account`, request.url))
}
