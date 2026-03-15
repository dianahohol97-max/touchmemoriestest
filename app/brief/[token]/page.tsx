import { notFound } from 'next/navigation';
import { getDesignBriefByToken } from '@/lib/designer-service/brief-helpers';
import BriefPageClient from './BriefPageClient';

interface PageProps {
  params: {
    token: string;
  };
}

export default async function BriefPage({ params }: PageProps) {
  const { token } = params;

  // Fetch brief data
  const brief = await getDesignBriefByToken(token);

  if (!brief) {
    notFound();
  }

  // Check if brief is already submitted
  if (brief.status !== 'waiting_brief') {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[3px] shadow-md p-8 text-center">
            <div className="text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Бриф вже відправлено
            </h1>
            <p className="text-gray-600 mb-6">
              Дякуємо! Ми вже отримали ваш бриф і працюємо над вашим дизайном.
            </p>
            {brief.status === 'brief_received' && (
              <div className="bg-blue-50 border border-blue-200 rounded-[3px] p-4">
                <p className="text-sm text-blue-800">
                  Наш AI-дизайнер зараз аналізує ваші фото. Незабаром дизайнер
                  доопрацює чернетку і надішле вам на перегляд.
                </p>
              </div>
            )}
            {brief.status === 'ai_processing' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-[3px] p-4">
                <p className="text-sm text-yellow-800">
                  AI обробляє ваші фото... Це може зайняти кілька хвилин.
                </p>
              </div>
            )}
            {(brief.status === 'ai_done' || brief.status === 'in_design') && (
              <div className="bg-purple-50 border border-purple-200 rounded-[3px] p-4">
                <p className="text-sm text-purple-800">
                  Дизайнер працює над вашим альбомом. Ми повідомимо вас, коли
                  дизайн буде готовий для перегляду.
                </p>
              </div>
            )}
            {brief.status === 'sent_for_review' && (
              <div className="bg-green-50 border border-green-200 rounded-[3px] p-4">
                <p className="text-sm text-green-800">
                  Дизайн готовий! Перевірте вашу електронну пошту для посилання
                  на перегляд.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if order is paid and has designer service
  const order = (brief as any).order;
  if (!order || !order.paid_at || !order.with_designer) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-[3px] shadow-md p-8 text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Доступ обмежено
            </h1>
            <p className="text-gray-600">
              Щоб заповнити бриф, замовлення має бути оплачене і включати
              послугу дизайнера.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <BriefPageClient
      token={token}
      brief={brief}
      orderNumber={order.order_number}
      customerName={order.customer?.name || ''}
    />
  );
}
