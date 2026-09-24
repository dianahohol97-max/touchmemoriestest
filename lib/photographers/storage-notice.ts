import { getAdminClient } from '@/lib/supabase/admin';
import { sendLoggedEmail } from '@/lib/email/send-logged';
import { getStorageUsage } from './usage';
import { handleStorageNotice } from './notices';

/**
 * Виклик для маршрутів аплоаду: після того, як рядок файлу вставлено,
 * перевірити, чи не час написати фотографу, що місце закінчується.
 *
 * Зайняте місце рахує getStorageUsage — та сама функція, що стоїть за
 * квотою й кабінетом, щоб лист і відмова 402 ніколи не розходилися в цифрах.
 *
 * Ніколи не кидає: аплоад уже відбувся, і лист не має права перетворити
 * успішну відповідь на помилку.
 */
export async function notifyStorageAfterUpload(
    photographer: { id: string; plan?: string | null; plan_expires_at?: string | null; storage_limit_mb?: number | null },
    uploadedBytes: number,
): Promise<void> {
    try {
        if (!uploadedBytes || uploadedBytes <= 0) return;
        const usage = await getStorageUsage(photographer);
        await handleStorageNotice({
            db: getAdminClient(),
            send: sendLoggedEmail,
            photographerId: photographer.id,
            usage,
            uploadedBytes,
            log: (message, context) => console.error(message, context),
        });
    } catch (e: any) {
        console.error('[photographer_storage_90] notice failed', { photographer: photographer.id, error: e?.message || String(e) });
    }
}
