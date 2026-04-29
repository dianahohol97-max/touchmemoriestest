import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@,()]+@[^\s@,()]+\.[^\s@,()]+$/;
const PHONE_RE = /^\+?[0-9 ()\-]{6,20}$/;

// In-memory rate limit: 5 registrations per IP per hour. Simple, but
// effective at preventing scripted account-creation abuse during a
// single-instance deploy. For multi-instance Vercel, this resets per
// invocation, which is OK as a stop-gap — replace with Upstash or
// similar if abuse is detected.
const registrationRate = new Map<string, { count: number; resetAt: number }>();
const REGISTER_LIMIT_PER_HOUR = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

function isWithinRegisterLimit(ip: string): boolean {
    const now = Date.now();
    const entry = registrationRate.get(ip);
    if (!entry || now >= entry.resetAt) {
        registrationRate.set(ip, { count: 1, resetAt: now + REGISTER_WINDOW_MS });
        return true;
    }
    if (entry.count >= REGISTER_LIMIT_PER_HOUR) return false;
    entry.count++;
    return true;
}

export async function POST(request: Request) {
    // Rate-limit by IP — register has no auth, so it's a DDoS / account-spam
    // surface without it.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || '127.0.0.1';
    if (!isWithinRegisterLimit(ip)) {
        return NextResponse.json(
            { error: 'Забагато реєстрацій з цієї IP. Спробуйте за годину.' },
            { status: 429 }
        );
    }

    const supabase = getAdminClient();
    try {
        const {
            email,
            password,
            name,
            phone,
            birthday_day,
            birthday_month,
            birthday_year
        } = await request.json();

        // Validate required fields
        if (!email || !password || !name) {
            return NextResponse.json(
                { error: 'Email, password, and name are required' },
                { status: 400 }
            );
        }

        // Input format validation. Without these, the route silently
        // accepts anything that fits the rough shape and forwards it to
        // Supabase Auth — which does its own checks but lets through a lot
        // of degenerate cases (extremely long names, control characters,
        // weird phone formats, etc).
        if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
            return NextResponse.json({ error: 'Невірний формат email' }, { status: 400 });
        }
        if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
            return NextResponse.json(
                { error: 'Пароль повинен містити мінімум 8 символів' },
                { status: 400 }
            );
        }
        if (typeof name !== 'string' || name.trim().length === 0 || name.length > 200) {
            return NextResponse.json({ error: 'Невірне ім\'я' }, { status: 400 });
        }
        if (phone !== undefined && phone !== null && phone !== '') {
            if (typeof phone !== 'string' || !PHONE_RE.test(phone)) {
                return NextResponse.json({ error: 'Невірний формат телефону' }, { status: 400 });
            }
        }

        // 1. Create auth user with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm email or set to false if you want email verification
        });

        if (authError) {
            return NextResponse.json(
                { error: authError.message },
                { status: 400 }
            );
        }

        const userId = authData.user.id;

        // 2. Create customer record with birthday info
        const { error: customerError } = await supabase
            .from('customers')
            .insert({
                id: userId,
                email,
                name,
                phone: phone || null,
                birthday_day: birthday_day || null,
                birthday_month: birthday_month || null,
                birthday_year: birthday_year || null,
            });

        if (customerError) {
            // Rollback: delete the auth user if customer creation fails
            await supabase.auth.admin.deleteUser(userId);
            return NextResponse.json(
                { error: 'Failed to create customer profile' },
                { status: 500 }
            );
        }

        // 3. Sync birthday to subscribers table if they are already a subscriber
        if (birthday_day && birthday_month) {
            const { data: existingSubscriber } = await supabase
                .from('subscribers')
                .select('id')
                .eq('email', email)
                .single();

            if (existingSubscriber) {
                await supabase
                    .from('subscribers')
                    .update({
                        birthday_day,
                        birthday_month,
                        name // Also update name if they provided it
                    })
                    .eq('email', email);
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Реєстрація успішна!',
            user: {
                id: userId,
                email,
                name
            }
        });

    } catch (err: any) {
        console.error('Registration Error:', err);
        return NextResponse.json(
            { error: err.message || 'Registration failed' },
            { status: 500 }
        );
    }
}
