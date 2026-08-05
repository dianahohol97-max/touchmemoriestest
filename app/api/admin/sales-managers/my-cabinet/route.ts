import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/auth/guards';

export const dynamic = 'force-dynamic';

/**
 * Кабінет продажів залогіненого співробітника (Diana, 2026-08-06).
 *
 * Роль менеджера з продажів замислювалась і для зовнішніх людей, тому робочий
 * кабінет живе за приватним посиланням-токеном. Але коли цю роль отримує свій
 * персонал — люди, які й так щодня в адмінці, — тримати посилання окремо в
 * нотатках незручно. Цей роут знаходить кабінет за поштою поточної сесії, і
 * пункт «Мій кабінет продажів» в адмінці веде туди без жодних посилань.
 *
 * Збіг за поштою сесії безпечний: пошта в auth підтверджена входом, а в
 * sales_managers вона унікальна — це та сама людина. Той самий принцип, що й у
 * привʼязці партнерського кабінету до акаунта.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getAdminClient();
  const { data: manager } = await admin
    .from('sales_managers')
    .select('cabinet_token, name, is_active')
    .ilike('email', likeEscape(user.email))
    .maybeSingle();

  if (!manager || !manager.is_active) {
    return NextResponse.json({
      error: 'Вашу пошту не додано до менеджерів з продажів. Якщо це помилка — зверніться до Діани.',
    }, { status: 404 });
  }

  return NextResponse.json({ cabinet_token: manager.cabinet_token, name: manager.name });
}
