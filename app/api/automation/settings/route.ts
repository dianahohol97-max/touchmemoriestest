import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

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
  try {
    const supabase = await createClient();
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
