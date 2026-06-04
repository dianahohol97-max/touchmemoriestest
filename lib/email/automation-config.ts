import { getAdminClient } from '@/lib/supabase/admin';

export interface AutomationEmailConfig {
    key: string;
    label: string;
    enabled: boolean;
    subject: string | null;
    body: string | null;
    promo_code: string | null;
}

// Loads the editable config for an automation email. Returns null if the row
// is missing (caller should fall back to coded defaults). Never throws.
export async function getAutomationConfig(key: string): Promise<AutomationEmailConfig | null> {
    try {
        const supabase = getAdminClient();
        const { data } = await supabase
            .from('automation_emails')
            .select('key, label, enabled, subject, body, promo_code')
            .eq('key', key)
            .maybeSingle();
        return (data as AutomationEmailConfig) || null;
    } catch {
        return null;
    }
}
