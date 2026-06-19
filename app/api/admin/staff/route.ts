import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';
import { sendEmail } from '@/lib/email/resend';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

type SB = ReturnType<typeof getAdminClient>;

// Generate a readable, strong-enough temporary password. The teammate is
// expected to change it after first login.
function genTempPassword(): string {
    const raw = crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    return `Tm${raw}`.slice(0, 12) + '9a';
}

function staffWelcomeEmailHtml(name: string, email: string, tempPassword: string, loginUrl: string): string {
    const first = (name || '').trim().split(/\s+/)[0] || 'колего';
    return `<!doctype html><html><body style="margin:0;background:#f4f6fb;font-family:'Open Sans',Arial,sans-serif;color:#2d2926;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <div style="background:#263A99;border-radius:12px 12px 0 0;padding:24px 28px;">
      <span style="color:#fff;font-size:20px;font-weight:800;letter-spacing:0.04em;">touch.memories</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;padding:28px;">
      <h1 style="font-size:20px;margin:0 0 16px;color:#263A99;">Вітаємо в команді, ${first}!</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Для вас створено доступ до адмін-панелі TouchMemories. Ось дані для входу:</p>
      <div style="background:#f4f6fb;border-radius:10px;padding:18px 20px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:14px;"><b>Логін (email):</b> ${email}</p>
        <p style="margin:0;font-size:14px;"><b>Тимчасовий пароль:</b> <span style="font-family:monospace;font-size:15px;background:#fff;padding:2px 8px;border-radius:6px;border:1px solid #e2e8f0;">${tempPassword}</span></p>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#263A99;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:8px;">Увійти в адмін-панель</a>
      <p style="font-size:13px;line-height:1.6;color:#6b5f58;margin:22px 0 0;">З міркувань безпеки змініть пароль після першого входу. Якщо ви не очікували цього листа — просто проігноруйте його.</p>
    </div>
  </div>
</body></html>`;
}

/**
 * Create a Supabase Auth login for a newly-added teammate and email them a
 * temporary password. Idempotent + best-effort: if an auth user already exists
 * for the email it does nothing (returns created=false, no email), and any
 * failure here never blocks the staff row from being saved.
 */
async function provisionStaffLogin(
    supabase: SB,
    email: string | null | undefined,
    name: string | null | undefined,
    opts: { force?: boolean } = {},
): Promise<{ created: boolean; reset: boolean; emailed: boolean; tempPassword?: string; note?: string }> {
    const addr = (email || '').trim().toLowerCase();
    if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
        return { created: false, reset: false, emailed: false, note: 'no-valid-email' };
    }

    const tempPassword = genTempPassword();
    let action: 'created' | 'reset' | null = null;
    let note: string | undefined;

    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: addr,
        password: tempPassword,
        email_confirm: true,
    });

    if (!createErr && created?.user) {
        action = 'created';
    } else {
        const msg = (createErr?.message || '').toLowerCase();
        if (/already|registered|exist/.test(msg)) {
            // Account already exists. If it has NO email+password credential
            // (e.g. it was created via Google sign-in), set the temp password so
            // the teammate can use the email+password admin login. If it already
            // has a working password, leave it untouched.
            let row: any = null;
            try {
                const { data: look } = await supabase.rpc('staff_auth_lookup', { p_email: addr });
                row = Array.isArray(look) ? look[0] : look;
            } catch (e) {
                console.error('staff_auth_lookup failed:', e);
            }
            if (row?.uid && (opts.force || row.has_password === false)) {
                const { error: updErr } = await supabase.auth.admin.updateUserById(row.uid, {
                    password: tempPassword,
                    email_confirm: true,
                });
                if (!updErr) action = 'reset';
                else note = 'set-password-failed';
            } else {
                note = 'account-exists-has-password';
            }
        } else {
            note = createErr?.message || 'create-failed';
        }
    }

    if (!action) {
        return { created: false, reset: false, emailed: false, note };
    }

    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://touchmemories.com.ua').replace(/\/$/, '');
    const loginUrl = `${baseUrl}/admin/login`;

    let emailed = false;
    try {
        const res = await sendEmail({
            to: addr,
            subject: 'Доступ до адмін-панелі TouchMemories',
            html: staffWelcomeEmailHtml(name || '', addr, tempPassword, loginUrl),
        });
        emailed = !!(res as any)?.success;
    } catch (e) {
        console.error('staff welcome email failed:', e);
    }

    // Return the temp password so the admin UI can show it as a fallback if the
    // email failed to send.
    return { created: action === 'created', reset: action === 'reset', emailed, tempPassword };
}

// Some staff columns (e.g. daily_base_rate / commission_percentage / piece_rate)
// may not yet exist on every environment's `staff` table — the form/type carry
// them but a migration may be pending on prod. Rather than fail the whole save
// with a generic error, we drop any column Postgres reports as missing (42703)
// and retry, so adding a teammate never gets blocked by a not-yet-migrated rate
// field. Once the migration lands, the full row inserts on the first attempt.
async function insertResilient(supabase: SB, row: Record<string, any>) {
    let payload = { ...row };
    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('staff').insert([payload]).select().single();
        if (!error) return { data, dropped: Object.keys(row).filter(k => !(k in payload)) };
        if (error.code === '42703') {
            const col = /column "([^"]+)"/.exec(error.message || '')?.[1];
            if (col && col in payload) { delete (payload as any)[col]; continue; }
        }
        return { error };
    }
    return { error: { message: 'Too many unknown columns' } as any };
}

async function updateResilient(supabase: SB, id: string, updates: Record<string, any>) {
    let payload = { ...updates };
    for (let attempt = 0; attempt < 8; attempt++) {
        const { data, error } = await supabase.from('staff').update(payload).eq('id', id).select().single();
        if (!error) return { data };
        if (error.code === '42703') {
            const col = /column "([^"]+)"/.exec(error.message || '')?.[1];
            if (col && col in payload) { delete (payload as any)[col]; continue; }
        }
        return { error };
    }
    return { error: { message: 'Too many unknown columns' } as any };
}

export async function GET() {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();

        // Explicit "send login credentials" action from the team page: force a
        // password reset on the teammate's account and email them the new temp
        // password — even if they already had a working password.
        if (body.action === 'send_login' && body.id) {
            const { data: st, error: stErr } = await supabase
                .from('staff').select('email, name').eq('id', body.id).single();
            if (stErr || !st?.email) {
                return NextResponse.json({ error: 'Співробітника не знайдено або відсутній email' }, { status: 404 });
            }
            const login = await provisionStaffLogin(supabase, st.email, st.name, { force: true });
            return NextResponse.json({ _login: login });
        }

        // Empty-string UUID/FK values must become null, not '' (invalid uuid).
        if (body.role_id === '') body.role_id = null;

        // Ensure initials are created if not provided directly
        if (!body.initials && body.name) {
            body.initials = body.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
        }

        const { data, error } = await insertResilient(supabase, body);
        if (error) throw error;

        // Auto-create a login + email a temporary password to the new teammate.
        // Best-effort: never fails the save. Returns the temp password so the UI
        // can show it if the email didn't go through.
        const login = await provisionStaffLogin(supabase, body.email, body.name);

        return NextResponse.json({ ...data, _login: login });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const supabase = getAdminClient();
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ error: 'Missing staff ID' }, { status: 400 });
        }

        if (updates.role_id === '') updates.role_id = null;

        const { data, error } = await updateResilient(supabase, id, updates);
        if (error) throw error;

        // If this teammate still has no login account (e.g. they were added
        // before auto-provisioning existed), create one now + email it. No-op
        // if they already have an account.
        const email = (updates.email ?? (data as any)?.email) as string | undefined;
        const name = (updates.name ?? (data as any)?.name) as string | undefined;
        const login = await provisionStaffLogin(supabase, email, name);

        return NextResponse.json({ ...data, _login: login });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
