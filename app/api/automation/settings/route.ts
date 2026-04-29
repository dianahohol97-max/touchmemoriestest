import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/auth/guards';

/**
 * Auth: admin-only. Reading or modifying automation settings (which control
 * production deadlines, auto-assignment behaviour, status-change emails)
 * is privileged business config — anyone could otherwise toggle automation
 * off, change deadlines, or rewrite status-change templates.
 *
 * Switched DB client to admin (service-role) because automation_settings
 * RLS is admin-only, and we've already authenticated the caller above.
 */

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('automation_settings')
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching automation settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation settings' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const supabase = getAdminClient();
    const body = await request.json();

    // Get current settings
    const { data: current } = await supabase
      .from('automation_settings')
      .select('id')
      .single();

    if (!current) {
      return NextResponse.json(
        { error: 'Settings not found' },
        { status: 404 }
      );
    }

    const { data, error } = await supabase
      .from('automation_settings')
      .update(body)
      .eq('id', current.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating automation settings:', error);
    return NextResponse.json(
      { error: 'Failed to update automation settings' },
      { status: 500 }
    );
  }
}
