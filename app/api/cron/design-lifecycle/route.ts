import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://touchmemories.com.ua';

//  Auth check 
function unauthorized(req: Request) {
    const auth = req.headers.get('authorization');
    return auth !== `Bearer ${process.env.CRON_SECRET}`;
}

//  Main cron handler 
export async function GET(request: Request) {
    if (unauthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getAdminClient();
    const now = new Date();

    const stats = {
        designs_notified_24h: 0,
        designs_notified_10d: 0,
        designs_notified_55d: 0,
        designs_notified_59d: 0,
        designs_deleted: 0,
        orders_notified_24h: 0,
        errors: 0,
    };

    try {
        //  1. EDITOR PROJECTS lifecycle 
        await processEditorProjects(supabase, now, stats);

        //  2. UNPAID ORDERS — 24h abandoned reminder 
        await processAbandonedOrders(supabase, now, stats);

        return NextResponse.json({
            ok: true,
            run_at: now.toISOString(),
            stats,
        });

    } catch (err: any) {
        console.error('[design-lifecycle cron] Fatal error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

//  Editor projects lifecycle 

async function processEditorProjects(supabase: any, now: Date, stats: any) {
    // Fetch all draft projects with owner email (via auth.users)
    const { data: projects, error } = await supabase
        .from('projects')
        .select('id, name, product_type, format, status, created_at, updated_at, user_id, notified_24h_at, notified_10d_at, notified_55d_at, notified_59d_at')
        .eq('status', 'draft')
        .not('user_id', 'is', null);

    if (error) { console.error('[lifecycle] projects fetch error:', error); return; }
    if (!projects?.length) return;

    // Get emails for all user_ids in one query
    const userIds = [...new Set(projects.map((p: any) => p.user_id))];
    const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const emailMap: Record<string, string> = {};
    (authUsers?.users || []).forEach((u: any) => { emailMap[u.id] = u.email; });

    for (const project of projects) {
        const email = emailMap[project.user_id];
        if (!email) continue;

        const createdAt = new Date(project.created_at);
        const ageMs = now.getTime() - createdAt.getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const designName = project.name || (project.product_type ? `${project.product_type}${project.format ? ' ' + project.format : ''}` : 'Ваш дизайн');

        try {
            //  60d: DELETE 
            if (ageDays >= 60) {
                await supabase.from('projects').delete().eq('id', project.id);
                stats.designs_deleted++;
                console.log(`[lifecycle] Deleted project ${project.id} (age: ${ageDays.toFixed(0)}d)`);
                continue;
            }

            //  59d: Final warning (24h before deletion) 
            if (ageDays >= 59 && !project.notified_59d_at) {
                const sent = await sendLifecycleEmail(email, '59d', designName, project.id);
                if (sent) {
                    await supabase.from('projects').update({ notified_59d_at: now.toISOString() }).eq('id', project.id);
                    stats.designs_notified_59d++;
                }
                continue;
            }

            //  55d: Warning — deleted in 5 days 
            if (ageDays >= 55 && !project.notified_55d_at) {
                const sent = await sendLifecycleEmail(email, '55d', designName, project.id);
                if (sent) {
                    await supabase.from('projects').update({ notified_55d_at: now.toISOString() }).eq('id', project.id);
                    stats.designs_notified_55d++;
                }
                continue;
            }

            //  10d: Second reminder 
            if (ageDays >= 10 && !project.notified_10d_at) {
                const sent = await sendLifecycleEmail(email, '10d', designName, project.id);
                if (sent) {
                    await supabase.from('projects').update({ notified_10d_at: now.toISOString() }).eq('id', project.id);
                    stats.designs_notified_10d++;
                }
                continue;
            }

            //  24h: First reminder 
            if (ageDays >= 1 && !project.notified_24h_at) {
                const sent = await sendLifecycleEmail(email, '24h', designName, project.id);
                if (sent) {
                    await supabase.from('projects').update({ notified_24h_at: now.toISOString() }).eq('id', project.id);
                    stats.designs_notified_24h++;
                }
            }

        } catch (e: any) {
            console.error(`[lifecycle] Error processing project ${project.id}:`, e.message);
            stats.errors++;
        }
    }
}

//  Abandoned orders (unpaid, 24h) 

async function processAbandonedOrders(supabase: any, now: Date, stats: any) {
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, customer_email, total, items, created_at')
        .in('payment_status', ['pending', 'unpaid'])
        .is('notified_abandoned_at', null)
        .lt('created_at', cutoff24h)
        .not('customer_email', 'is', null);

    if (error) { console.error('[lifecycle] orders fetch error:', error); return; }
    if (!orders?.length) return;

    for (const order of orders) {
        try {
            const sent = await sendAbandonedOrderEmail(order);
            if (sent) {
                await supabase.from('orders')
                    .update({ notified_abandoned_at: now.toISOString() })
                    .eq('id', order.id);
                stats.orders_notified_24h++;
            }
        } catch (e: any) {
            console.error(`[lifecycle] Error processing order ${order.id}:`, e.message);
            stats.errors++;
        }
    }
}

//  Email senders 

async function sendLifecycleEmail(
    to: string,
    type: '24h' | '10d' | '55d' | '59d',
    designName: string,
    projectId: string,
): Promise<boolean> {
    const accountUrl = `${SITE_URL}/uk/account`;
    const editorUrl  = `${SITE_URL}/uk/editor/${projectId}`;

    const configs = {
        '24h': {
            subject: `⏳ Ваш дизайн чекає — «${designName}»`,
            preheader: 'Ви розпочали створення, але не завершили замовлення',
            emoji: '⏳',
            headline: 'Ваш дизайн збережено!',
            body: `Ви розпочали роботу над дизайном <strong>«${designName}»</strong> і він чекає на вас у вашому кабінеті. Завершіть оформлення замовлення, поки він доступний.`,
            cta: 'Продовжити оформлення',
            ctaUrl: editorUrl,
            urgency: null,
            color: '#263a99',
        },
        '10d': {
            subject: ` «${designName}» — не забудьте замовити!`,
            preheader: 'Ваш дизайн зберігається вже 10 днів',
            emoji: '',
            headline: '10 днів пройшло...',
            body: `Ваш дизайн <strong>«${designName}»</strong> зберігається вже 10 днів. Замовте зараз і отримайте готовий виріб з доставкою по Україні!`,
            cta: 'Завершити замовлення',
            ctaUrl: editorUrl,
            urgency: null,
            color: '#263a99',
        },
        '55d': {
            subject: ` Ваш дизайн буде видалено через 5 днів`,
            preheader: `«${designName}» — залишилося 5 днів до автоматичного видалення`,
            emoji: '',
            headline: 'Увага! Дизайн видалиться через 5 днів',
            body: `Ваш дизайн <strong>«${designName}»</strong> зберігається вже 55 днів. Через 5 днів він буде <strong>автоматично видалений</strong>. Завершіть замовлення зараз, щоб не втратити свою роботу.`,
            cta: 'Зберегти дизайн — замовити зараз',
            ctaUrl: editorUrl,
            urgency: 'Залишилося 5 днів',
            color: '#f59e0b',
        },
        '59d': {
            subject: ` Останній шанс! «${designName}» видаляється завтра`,
            preheader: 'За 24 години ваш дизайн буде безповоротно видалено',
            emoji: '',
            headline: 'Дизайн видаляється за 24 години!',
            body: `Це <strong>останнє нагадування</strong>. Ваш дизайн <strong>«${designName}»</strong> буде видалено завтра. Після цього відновлення буде неможливим. Замовте прямо зараз!`,
            cta: ' Замовити негайно',
            ctaUrl: editorUrl,
            urgency: 'Залишилося менше 24 годин',
            color: '#ef4444',
        },
    };

    const c = configs[type];

    const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${c.subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e2d7d,#263a99);padding:32px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;">${c.emoji}</div>
      <div style="color:white;font-size:22px;font-weight:900;letter-spacing:-0.5px;">${c.headline}</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:6px;">Touch.Memories</div>
    </div>

    ${c.urgency ? `
    <!-- Urgency banner -->
    <div style="background:${c.color};padding:12px 40px;text-align:center;">
      <span style="color:white;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;">⏰ ${c.urgency}</span>
    </div>` : ''}

    <!-- Body -->
    <div style="padding:36px 40px;">
      <p style="color:#0f172a;font-size:15px;line-height:1.7;margin:0 0 24px;">${c.body}</p>

      <!-- Design preview card -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:0 0 28px;display:flex;align-items:center;gap:16px;">
        <div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#eff3ff,#e0e7ff);display:inline-flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;"></div>
        <div>
          <div style="font-weight:800;color:#263a99;font-size:15px;margin-bottom:2px;">${designName}</div>
          <div style="font-size:12px;color:#94a3b8;">Збережено у вашому кабінеті</div>
        </div>
      </div>

      <!-- CTA button -->
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${c.ctaUrl}" style="display:inline-block;padding:16px 36px;background:${c.color};color:white;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;letter-spacing:-0.3px;">
          ${c.cta} →
        </a>
      </div>

      <!-- Secondary link -->
      <div style="text-align:center;margin-bottom:8px;">
        <a href="${accountUrl}" style="color:#64748b;font-size:13px;text-decoration:none;">Переглянути всі мої дизайни →</a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">
        Touch.Memories — Фотокниги, постери та фотовироби
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;">
        Ви отримали цей лист, тому що у вас є збережений дизайн.<br>
        <a href="${SITE_URL}/uk/account" style="color:#94a3b8;">Управляти сповіщеннями</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    const result = await sendEmail({ to, subject: c.subject, html });
    if (!result.success) {
        console.error(`[lifecycle] Failed to send ${type} email to ${to}:`, result.error);
        return false;
    }
    console.log(`[lifecycle] Sent ${type} email to ${to} for project ${projectId}`);
    return true;
}

async function sendAbandonedOrderEmail(order: any): Promise<boolean> {
    const to = order.customer_email;
    const name = order.customer_name?.split(' ')[0] || 'Клієнте';
    const cartUrl = `${SITE_URL}/uk/cart`;
    const accountUrl = `${SITE_URL}/uk/account`;

    const itemsHtml = (order.items || []).slice(0, 3).map((item: any) => `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
        ${item.image ? `<img src="${item.image}" width="44" height="44" style="border-radius:8px;object-fit:cover;" alt="${item.name}"/>` : '<div style="width:44px;height:44px;border-radius:8px;background:#e2e8f0;"></div>'}
        <div style="flex:1;">
          <div style="font-weight:700;font-size:13px;color:#0f172a;">${item.name || 'Товар'}</div>
          <div style="font-size:12px;color:#94a3b8;">${item.qty || 1} шт. × ${item.price || 0} ₴</div>
        </div>
      </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="uk">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Незавершене замовлення</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <div style="background:linear-gradient(135deg,#1e2d7d,#263a99);padding:32px 40px;text-align:center;">
      <div style="font-size:40px;margin-bottom:12px;"></div>
      <div style="color:white;font-size:22px;font-weight:900;">Ви забули щось у кошику!</div>
      <div style="color:rgba(255,255,255,0.75);font-size:13px;margin-top:6px;">Touch.Memories</div>
    </div>

    <div style="padding:36px 40px;">
      <p style="color:#0f172a;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Привіт, <strong>${name}</strong>! Ви розпочали оформлення замовлення <strong>#${order.order_number}</strong>, але не завершили оплату. Ваші товари все ще чекають на вас!
      </p>

      <!-- Order items -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:12px;padding:16px 20px;margin:0 0 28px;">
        <div style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;">Ваше замовлення</div>
        ${itemsHtml}
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;margin-top:4px;">
          <span style="font-size:13px;color:#64748b;">Разом:</span>
          <span style="font-size:20px;font-weight:900;color:#263a99;">${order.total} ₴</span>
        </div>
      </div>

      <div style="text-align:center;margin-bottom:20px;">
        <a href="${cartUrl}" style="display:inline-block;padding:16px 36px;background:#263a99;color:white;text-decoration:none;border-radius:12px;font-weight:800;font-size:16px;">
          Завершити замовлення →
        </a>
      </div>
      <div style="text-align:center;">
        <a href="${accountUrl}" style="color:#64748b;font-size:13px;text-decoration:none;">Переглянути мої замовлення →</a>
      </div>
    </div>

    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 8px;">Touch.Memories — Фотокниги, постери та фотовироби</p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;">
        Ви отримали цей лист, тому що не завершили оформлення замовлення.
      </p>
    </div>
  </div>
</body>
</html>`;

    const result = await sendEmail({
        to,
        subject: ` Ваше замовлення #${order.order_number} чекає на оплату`,
        html,
    });

    if (!result.success) {
        console.error(`[lifecycle] Failed to send abandoned email to ${to}:`, result.error);
        return false;
    }
    console.log(`[lifecycle] Sent abandoned order email to ${to} for order ${order.id}`);
    return true;
}
