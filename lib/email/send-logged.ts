import { sendBrevoEmail } from '@/lib/email/brevo';
import {
    logOutgoingEmail,
    readSendOutcome,
    sendOutcomeFromError,
    htmlToTextSnapshot,
    type SendOutcome,
} from '@/lib/email/log-outgoing';

/**
 * Відправити лист і записати його в журнал — одним викликом.
 *
 * НАВІЩО. Підводити під журнал кожен із сорока з гаком відправників окремо
 * означало б сорок разів написати той самий блок try/catch навколо великого
 * HTML-літерала, і кожен був би трохи іншим — саме так у цьому репозиторії вже
 * розійшлося реферальне посилання по пʼятьох місцях. Тут виклик лишається
 * однорядковим, а рядок журналу пишеться завжди: і на успіх, і на відмову
 * (Діана, 16.09.2026).
 *
 * Повертає розбір відповіді провайдера, тож той, хто кличе, може прийняти
 * рішення сам — показати помилку, повторити, чи мовчки піти далі.
 */
export async function sendLoggedEmail(
    params: Parameters<typeof sendBrevoEmail>[0],
    meta: { template: string; orderId?: string | null },
): Promise<SendOutcome> {
    let outcome: SendOutcome;
    try {
        outcome = readSendOutcome(await sendBrevoEmail(params));
    } catch (e: any) {
        console.error(`[${meta.template}] send failed for`, params.to, e?.message || e);
        outcome = sendOutcomeFromError(e);
    }

    await logOutgoingEmail({
        orderId: meta.orderId ?? null,
        to: params.to,
        template: meta.template,
        subject: params.subject,
        body: htmlToTextSnapshot(params.html || ''),
        outcome,
    });

    return outcome;
}
