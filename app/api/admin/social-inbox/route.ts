import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, getSession } from '@/lib/auth/guards';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const STATUSES = new Set(['ai_handling', 'human_handling', 'resolved']);

/**
 * AI Inbox — розмови в соцмережах.
 *
 * Сторінка читала й писала social_conversations та social_messages прямо з
 * браузера. Обидві таблиці закриті політикою is_admin_user(), тобто «email є
 * в admin_users», а туди входять четверо з чотирнадцяти активних
 * співробітників. Для решти інбокс був порожній, хоча менеджеру за роллю ai
 * виставлено full — тобто розділ відкритий, а всередині нічого немає.
 *
 * Гірше було з відповіддю клієнту: вставка в social_messages не проходила, але
 * помилки не давала на читанні, а сам текст усе одно вирушав у Telegram
 * окремим викликом. Повідомлення доходило до клієнта і зникало з історії
 * розмови — наступний менеджер не бачив, що йому вже відповіли.
 *
 * GET  ?conversationId=… — повідомлення однієї розмови; без параметра — список
 *      розмов.
 * POST — { action: 'read' | 'status' | 'message' }.
 */
export async function GET(req: NextRequest) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const admin = getAdminClient();
    const conversationId = req.nextUrl.searchParams.get('conversationId');

    if (conversationId) {
        const { data, error } = await admin
            .from('social_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('sent_at', { ascending: true });
        if (error) {
            console.error('[social-inbox] messages read failed', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ messages: data || [] });
    }

    const { data, error } = await admin
        .from('social_conversations')
        .select('*')
        .order('last_message_at', { ascending: false });
    if (error) {
        console.error('[social-inbox] conversations read failed', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ conversations: data || [] });
}

export async function POST(req: NextRequest) {
    const guard = await requireStaff();
    if (!guard.ok) return guard.response;

    const body = await req.json().catch(() => null);
    const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : '';
    const action = String(body?.action || '');
    if (!conversationId) return NextResponse.json({ error: 'conversationId required' }, { status: 400 });

    const admin = getAdminClient();

    if (action === 'read') {
        const { error } = await admin
            .from('social_conversations')
            .update({ is_read: true })
            .eq('id', conversationId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    if (action === 'status') {
        const status = String(body?.status || '');
        if (!STATUSES.has(status)) return NextResponse.json({ error: 'Unsupported status' }, { status: 400 });
        const patch: Record<string, any> = { status };
        // «Веде менеджер» означає конкретного менеджера — того, хто натиснув.
        if (status === 'human_handling') {
            const { user } = await getSession();
            if (user?.id) patch.assigned_to = user.id;
        }
        const { error } = await admin
            .from('social_conversations')
            .update(patch)
            .eq('id', conversationId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true });
    }

    if (action === 'message') {
        const text = String(body?.text || '').trim();
        if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });
        const { error } = await admin.from('social_messages').insert({
            conversation_id: conversationId,
            sender: 'human_manager',
            original_text: text,
        });
        if (error) {
            console.error('[social-inbox] message insert failed', error.message);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
