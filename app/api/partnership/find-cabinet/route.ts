import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { likeEscape } from '@/lib/supabase/like-escape';
import { sendBrevoEmail, getBrevoApiKey } from '@/lib/email/brevo';
import { normalizeBindingEmail } from '@/lib/agency/binding';
import { logOutgoingEmail, readSendOutcome, sendOutcomeFromError, htmlToTextSnapshot } from '@/lib/email/log-outgoing';
import {
    FIND_CABINET_EMAIL_COOLDOWN_MS,
    FIND_CABINET_IP_LIMIT,
    FIND_CABINET_IP_WINDOW_MS,
    FIND_CABINET_REPLY,
    buildCabinetRecoveryEmail,
    decideCabinetRecovery,
    markEmailSent,
    onEmailCooldown,
    overWindowLimit,
    type WindowState,
} from '@/lib/partners/find-cabinet';

export const dynamic = 'force-dynamic';

/**
 * POST /api/partnership/find-cabinet  { email }
 *
 * Партнер загубив вітальний лист і просить надіслати посилання на кабінет ще
 * раз. Правила, причини й межі цього механізму — у lib/partners/find-cabinet.ts;
 * тут лише їх виконання.
 *
 * Коротко про головне: відповідь на екрані ОДНА для всіх випадків, статус
 * завжди 200, а посилання виходить назовні виключно листом на пошту з запису
 * партнера. Введена адреса — це ключ пошуку, а не адресат.
 */

// Лічильники живуть у памʼяті процесу, як і в решти публічних форм проєкту.
// Холодний старт їх обнуляє, і між інстансами вони не спільні — це стеля проти
// випадкового натискання й скрипту-одноденки, а не проти впертого зловмисника.
const ipHits = new Map<string, WindowState>();
const emailSent = new Map<string, number>();

/** Та сама відповідь, хоч би що сталося всередині. */
const neutral = () => NextResponse.json({ ok: true, message: FIND_CABINET_REPLY });

export async function POST(request: Request) {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    if (overWindowLimit(ipHits, ip, FIND_CABINET_IP_LIMIT, FIND_CABINET_IP_WINDOW_MS)) {
        // Єдиний випадок, коли відповідь інша: вона не каже нічого про пошту,
        // лише про те, що з цієї адреси просили забагато.
        return NextResponse.json(
            { ok: false, message: 'Забагато спроб. Спробуйте за годину або напишіть нам.' },
            { status: 429 },
        );
    }

    const body = await request.json().catch(() => ({}));
    const email = normalizeBindingEmail((body as any)?.email);
    // Навіть відверте сміття у відповідь отримує те саме, що й справжня пошта.
    if (!email) return neutral();

    const admin = getAdminClient();
    const { data: partners } = await admin
        .from('agency_partners')
        .select('id, agency_name, email, cabinet_token, status')
        .ilike('email', likeEscape(email))
        .order('created_at', { ascending: false })
        .limit(1);

    // Рішення — у lib/partners/find-cabinet: не знайшли, призупинений, немає
    // токена чи пошти дають ту саму мовчазну відмову, а адресат береться з
    // рядка партнера, а не з форми.
    const action = decideCabinetRecovery({ submittedEmail: email, partner: partners?.[0] });
    if (action.kind !== 'send') return neutral();

    const recipient = action.to;
    if (onEmailCooldown(emailSent, recipient, FIND_CABINET_EMAIL_COOLDOWN_MS)) return neutral();
    if (!getBrevoApiKey()) {
        console.error('[find-cabinet] Brevo is not configured, no link was sent');
        return neutral();
    }

    const mail = buildCabinetRecoveryEmail({
        agencyName: action.agencyName,
        cabinetToken: action.cabinetToken,
        email: recipient,
    });

    // Позначка ставиться ДО відправки: інакше два запити, що прийшли разом,
    // обидва пройшли б перевірку і надіслали два листи.
    markEmailSent(emailSent, recipient);

    let outcome;
    try {
        outcome = readSendOutcome(await sendBrevoEmail({
            to: recipient,
            toName: action.agencyName || undefined,
            subject: mail.subject,
            html: mail.html,
        }));
    } catch (e) {
        outcome = sendOutcomeFromError(e);
        console.error('[find-cabinet] send failed:', e);
    }

    /**
     * Журнал тут не для звітності, а тому, що екран мовчить навмисно. Коли
     * партнер каже «лист не прийшов», це єдине місце, де видно, чи він пішов і
     * що відповів Brevo. Замовлення в цього листа немає, тож order_id порожній.
     */
    await logOutgoingEmail({
        orderId: null,
        to: recipient,
        template: 'partner_cabinet_recovery',
        subject: mail.subject,
        body: htmlToTextSnapshot(mail.html),
        outcome,
    });

    return neutral();
}
