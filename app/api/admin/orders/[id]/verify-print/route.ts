import { NextResponse } from 'next/server';
import { requireStaff } from '@/lib/auth/guards';
import { verifyOrderPrint } from '@/lib/print/verify-order-print';

export const dynamic = 'force-dynamic';
// Перевірка відкриває кожен файл: 32-сторінкова книга це 33 великі JPEG.
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST /api/admin/orders/[id]/verify-print
 *
 * Звіряє готові файли з тим, що клієнт склав у конструкторі, і повертає
 * висновок по кожному виробу. Кнопка «Перевірити макети» на картці замовлення.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const { id } = await params;
    try {
        const report = await verifyOrderPrint(id);
        // `report.ok` — це висновок перевірки, а не «запит вдався»; він і має
        // потрапити у відповідь.
        return NextResponse.json(report);
    } catch (e: any) {
        console.error('[verify-print] failed', { orderId: id, error: e?.message });
        return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
    }
}
