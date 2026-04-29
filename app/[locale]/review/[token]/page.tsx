import { getAdminClient } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import ReviewPageClient from './ReviewPageClient';

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Token-validated public access goes through service role: regular RLS on
  // customer_projects locks reads to admins only, so the share_token lookup
  // must bypass it. The token itself is the authentication.
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(token)) notFound();

  const supabase = getAdminClient();

  const { data: project } = await supabase
    .from('customer_projects')
    .select('*, order:orders(id, order_number, customer_name, items)')
    .eq('share_token', token)
    .single();

  if (!project) notFound();

  return <ReviewPageClient project={project} token={token} />;
}
