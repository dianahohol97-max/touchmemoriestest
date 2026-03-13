import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface DesignOrder {
  id: string;
  order_id: string;
  token: string;
  occasion: string;
  style_preference: string;
  photos_count: number;
  status: string;
  submitted_at: string | null;
  ai_processed_at: string | null;
  ai_error: string | null;
  order: {
    order_number: string;
    customer: {
      name: string;
      email: string;
    };
  };
}

export default async function DesignOrdersPage() {
  const supabase = await createClient();

  // Fetch all design briefs with orders
  const { data: briefs, error } = await supabase
    .from('design_briefs')
    .select(`
      *,
      order:orders(
        order_number,
        customer:customers(name, email)
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching briefs:', error);
  }

  const designOrders = (briefs as any[]) || [];

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { label: string; className: string } } = {
      waiting_brief: { label: 'Очікує бриф', className: 'bg-gray-100 text-gray-800' },
      brief_received: { label: 'Бриф отримано', className: 'bg-blue-100 text-blue-800' },
      ai_processing: { label: 'AI обробляє', className: 'bg-yellow-100 text-yellow-800' },
      ai_done: { label: 'AI готово', className: 'bg-green-100 text-green-800' },
      in_design: { label: 'У дизайні', className: 'bg-purple-100 text-purple-800' },
      sent_for_review: { label: 'На перегляді', className: 'bg-indigo-100 text-indigo-800' },
      revision_requested: { label: 'Потрібні правки', className: 'bg-orange-100 text-orange-800' },
      approved: { label: 'Затверджено', className: 'bg-green-100 text-green-800' },
    };

    const badge = badges[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Замовлення з послугою дизайнера</h1>
        <p className="text-gray-600 mt-1">
          Керування брифами та дизайном фотоальбомів
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Всього</div>
          <div className="text-2xl font-bold text-gray-900">{designOrders.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">Очікують бриф</div>
          <div className="text-2xl font-bold text-yellow-600">
            {designOrders.filter((o) => o.status === 'waiting_brief').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">У роботі</div>
          <div className="text-2xl font-bold text-blue-600">
            {designOrders.filter((o) =>
              ['brief_received', 'ai_processing', 'ai_done', 'in_design'].includes(o.status)
            ).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500 mb-1">На перегляді</div>
          <div className="text-2xl font-bold text-purple-600">
            {designOrders.filter((o) =>
              ['sent_for_review', 'revision_requested'].includes(o.status)
            ).length}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Замовлення
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Клієнт
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Подія / Стиль
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Фото
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дата
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Дії
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {designOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  Немає замовлень з послугою дизайнера
                </td>
              </tr>
            ) : (
              designOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">
                      #{order.order?.order_number}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{order.order?.customer?.name}</div>
                    <div className="text-xs text-gray-500">{order.order?.customer?.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{order.occasion || '—'}</div>
                    <div className="text-xs text-gray-500">{order.style_preference || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.photos_count > 0 ? `${order.photos_count} фото` : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(order.status)}
                    {order.ai_error && (
                      <div className="text-xs text-red-600 mt-1">AI Error</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.submitted_at
                        ? new Date(order.submitted_at).toLocaleDateString('uk-UA')
                        : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {order.status === 'waiting_brief' ? (
                        <a
                          href={`/brief/${order.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Відкрити бриф
                        </a>
                      ) : (
                        <Link
                          href={`/admin/design-orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Переглянути
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
