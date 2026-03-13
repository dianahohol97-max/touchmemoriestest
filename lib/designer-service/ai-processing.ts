/**
 * Trigger AI processing for a design brief
 * This calls the Supabase Edge Function to analyze photos and generate layout
 */
export async function triggerAIProcessing(token: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/process-design-brief`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ token }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'AI processing failed');
    }

    const result = await response.json();
    return { success: true };
  } catch (error: any) {
    console.error('Error triggering AI processing:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check AI processing status for a brief
 */
export async function getAIProcessingStatus(token: string): Promise<{
  status: string;
  progress?: number;
  error?: string;
}> {
  // TODO: Implement real-time progress tracking
  // For now, just return the brief status
  return { status: 'processing' };
}
