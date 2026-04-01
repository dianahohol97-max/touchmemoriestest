import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ReviewPageClient from './ReviewPageClient';

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from('customer_projects')
    .select('*, order:orders(id, order_number, customer_name, items)')
    .eq('share_token', token)
    .single();

  if (!project) notFound();

  return <ReviewPageClient project={project} token={token} />;
}
