import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import ReviewPageClient from './ReviewPageClient';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function ReviewPage({ params }: PageProps) {
  const { token } = params;
  const supabase = await createClient();

  // Fetch revision by token
  const { data: revision, error } = await supabase
    .from('design_revisions')
    .select(`
      *,
      order:orders(
        id,
        order_number,
        customer:customers(name, email)
      ),
      project:photobook_projects(
        id,
        title,
        canvas_data
      )
    `)
    .eq('client_token', token)
    .single();

  if (error || !revision) {
    notFound();
  }

  // Check if already reviewed
  if (revision.client_decision) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">
              {revision.client_decision === 'approved' ? '✅' : '✏️'}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {revision.client_decision === 'approved'
                ? 'Дизайн затверджено!'
                : 'Правки запрошено'}
            </h1>
            <p className="text-gray-600">
              {revision.client_decision === 'approved'
                ? 'Дякуємо! Ваш альбом відправлений у виробництво.'
                : 'Дизайнер працює над вашими правками. Ми повідомимо, коли все буде готово.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ReviewPageClient
      revision={revision}
      orderNumber={(revision as any).order.order_number}
      customerName={(revision as any).order.customer.name}
    />
  );
}
