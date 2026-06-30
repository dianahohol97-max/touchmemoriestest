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
  // During build/prerender the service-role env vars may be absent, so
  // getAdminClient() returns null. Don't crash the whole build — just
  // return null and let the page render its "not found" fallback. The
  // page has revalidate=3600 so it'll fill in on the first runtime hit.
  if (!admin) return null;

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
