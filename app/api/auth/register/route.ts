import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
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
