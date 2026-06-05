//
// Builder for the "unfinished design" lifecycle reminder emails (24h / 10d /
// 55d / 59d). Shared by the design-lifecycle cron (sends) and the admin
// email-previews page (renders). Pure: no DB / network — returns { subject, html }.
//
export type LifecycleStage = '24h' | '10d' | '55d' | '59d';

export function buildLifecycleEmail(
    type: LifecycleStage,
    designName: string,
    projectId: string,
    siteUrl: string,
): { subject: string; html: string } {
    const accountUrl = `${siteUrl}/uk/account`;
    const editorUrl = `${siteUrl}/uk/editor/${projectId}`;

    const configs = {
        '24h': {
            subject: `⏳ Ваш дизайн чекає — «${designName}»`,
            emoji: '⏳',
            headline: 'Ваш дизайн збережено!',
            body: `Ви розпочали роботу над дизайном <strong>«${designName}»</strong> і він чекає на вас у вашому кабінеті. Завершіть оформлення замовлення, поки він доступний.`,
            cta: 'Продовжити оформлення',
            ctaUrl: editorUrl,
            urgency: null as string | null,
            color: '#263a99',
        },
        '10d': {
            subject: ` «${designName}» — не забудьте замовити!`,
            emoji: '',
            headline: '10 днів пройшло...',
            body: `Ваш дизайн <strong>«${designName}»</strong> зберігається вже 10 днів. Замовте зараз і отримайте готовий виріб з доставкою по Україні!`,
            cta: 'Завершити замовлення',
            ctaUrl: editorUrl,
            urgency: null as string | null,
            color: '#263a99',
        },
        '55d': {
            subject: ` Ваш дизайн буде видалено через 5 днів`,
            emoji: '',
            headline: 'Увага! Дизайн видалиться через 5 днів',
            body: `Ваш дизайн <strong>«${designName}»</strong> зберігається вже 55 днів. Через 5 днів він буде <strong>автоматично видалений</strong>. Завершіть замовлення зараз, щоб не втратити свою роботу.`,
            cta: 'Зберегти дизайн — замовити зараз',
            ctaUrl: editorUrl,
            urgency: 'Залишилося 5 днів' as string | null,
            color: '#f59e0b',
        },
        '59d': {
            subject: ` Останній шанс! «${designName}» видаляється завтра`,
            emoji: '',
            headline: 'Дизайн видаляється за 24 години!',
            body: `Це <strong>останнє нагадування</strong>. Ваш дизайн <strong>«${designName}»</strong> буде видалено завтра. Після цього відновлення буде неможливим. Замовте прямо зараз!`,
            cta: ' Замовити негайно',
            ctaUrl: editorUrl,
            urgency: 'Залишилося менше 24 годин' as string | null,
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
        <a href="${siteUrl}/uk/account" style="color:#94a3b8;">Управляти сповіщеннями</a>
      </p>
    </div>
  </div>
</body>
</html>`;

    return { subject: c.subject, html };
}
