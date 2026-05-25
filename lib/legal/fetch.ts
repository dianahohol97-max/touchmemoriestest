import { getAdminClient } from '@/lib/supabase/admin';

export interface LegalPage {
  id: string;
  document_type: string;
  locale: string;
  title: string;
  content_md: string;
  version: number;
  is_current: boolean;
  updated_at: string;
}

export async function fetchLegalPage(
  documentType: string,
  locale: string
): Promise<LegalPage | null> {
  const admin = getAdminClient();

  const { data } = await admin
    .from('legal_pages')
    .select('*')
    .eq('document_type', documentType)
    .eq('locale', locale)
    .eq('is_current', true)
    .maybeSingle();

  if (data) return data as LegalPage;

  if (locale !== 'uk') {
    const { data: fallback } = await admin
      .from('legal_pages')
      .select('*')
      .eq('document_type', documentType)
      .eq('locale', 'uk')
      .eq('is_current', true)
      .maybeSingle();

    return fallback as LegalPage | null;
  }

  return null;
}
