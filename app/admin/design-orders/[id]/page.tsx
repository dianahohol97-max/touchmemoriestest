import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, Eye } from 'lucide-react';
import type { PhotoMetadata } from '@/lib/types/designer-service';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DesignOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch brief with all related data
  const { data: brief, error } = await supabase
    .from('design_briefs')
    .select(`
      *,
      order:orders(
        id,
        order_number,
        with_designer,
        designer_service_fee,
        paid_at,
        customer:customers(name, email, phone),
        items:order_items(
          quantity,
          product:products(title, custom_attributes)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (error || !brief) {
    notFound();
  }

  const photos = (brief.photos_metadata as PhotoMetadata[]) || [];
  const order = (brief as any).order;
  const productInfo = order?.items?.[0]?.product;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/design-orders"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Назад до списку
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          Замовлення #{order?.order_number}
        </h1>
        <p className="text-gray-600 mt-1">
          Дизайн-бриф для {order?.customer?.name}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Brief Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Статус</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Поточний статус:</span>
                <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-800">
                  {brief.status}
                </span>
              </div>
              {brief.submitted_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Бриф відправлено:</span>
                  <span className="text-sm text-gray-900">
                    {new Date(brief.submitted_at).toLocaleString('uk-UA')}
                  </span>
                </div>
              )}
              {brief.ai_processed_at && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">AI обробив:</span>
                  <span className="text-sm text-gray-900">
                    {new Date(brief.ai_processed_at).toLocaleString('uk-UA')}
                  </span>
                </div>
              )}
              {brief.ai_error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>AI помилка:</strong> {brief.ai_error}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Brief Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Інформація з брифу
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Подія</dt>
                <dd className="text-sm font-medium text-gray-900">{brief.occasion || '—'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Стиль</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {brief.style_preference || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Подарунок</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {brief.is_gift ? 'Так' : 'Ні'}
                </dd>
              </div>
              {brief.title_text && (
                <div>
                  <dt className="text-sm text-gray-600">Текст на обкладинці</dt>
                  <dd className="text-sm font-medium text-gray-900">{brief.title_text}</dd>
                </div>
              )}
              {brief.important_photos && (
                <div>
                  <dt className="text-sm text-gray-600">Важливі фото</dt>
                  <dd className="text-sm text-gray-900">{brief.important_photos}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-600">Порядок фото</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {brief.photo_order || '—'}
                </dd>
              </div>
              {brief.additional_notes && (
                <div>
                  <dt className="text-sm text-gray-600">Додаткові побажання</dt>
                  <dd className="text-sm text-gray-900">{brief.additional_notes}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Photos Gallery */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Фотографії ({photos.length})
              </h2>
              {photos.length > 0 && (
                <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Download className="h-4 w-4" />
                  Завантажити всі
                </button>
              )}
            </div>

            {photos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Фото ще не завантажено</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative">
                    <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={photo.url}
                        alt={photo.filename}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 33vw, 25vw"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                        <a
                          href={photo.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 text-white"
                        >
                          <Eye className="h-6 w-6" />
                        </a>
                      </div>
                    </div>
                    {photo.score && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        {photo.score}/10
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1 truncate" title={photo.filename}>
                      {photo.filename}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Analysis Results */}
          {brief.ai_analysis_result && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Результати AI-аналізу
              </h2>
              <div className="space-y-3 text-sm">
                <p className="text-gray-600">
                  AI проаналізував {photos.length} фото та створив рекомендації для дизайну.
                </p>
                {/* You can add more detailed analysis display here */}
              </div>
            </div>
          )}

          {/* Layout Plan */}
          {brief.ai_layout_plan && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                План розкладки ({(brief.ai_layout_plan as any).total_pages} сторінок)
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                AI створив план розкладки на основі брифу та аналізу фото.
              </p>
              {/* You can add a visual preview of the layout here */}
              <button className="text-sm text-blue-600 hover:text-blue-800">
                Відкрити в редакторі
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Order Info & Actions */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Клієнт</h2>
            <dl className="space-y-2">
              <div>
                <dt className="text-sm text-gray-600">Ім'я</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {order?.customer?.name}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Email</dt>
                <dd className="text-sm text-gray-900">{order?.customer?.email}</dd>
              </div>
              {order?.customer?.phone && (
                <div>
                  <dt className="text-sm text-gray-600">Телефон</dt>
                  <dd className="text-sm text-gray-900">{order.customer.phone}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Product Info */}
          {productInfo && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Продукт</h2>
              <p className="text-sm text-gray-900 font-medium mb-2">
                {productInfo.title}
              </p>
              {/* Add product details here */}
            </div>
          )}

          {/* Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Дії</h2>
            <div className="space-y-2">
              {brief.status === 'waiting_brief' && (
                <a
                  href={`/brief/${brief.token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700"
                >
                  Відкрити бриф
                </a>
              )}
              {['ai_done', 'in_design'].includes(brief.status) && (
                <button className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                  Відкрити в редакторі
                </button>
              )}
              {brief.status === 'in_design' && (
                <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Надіслати на перегляд
                </button>
              )}
              {brief.ai_error && (
                <button className="w-full px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                  Повторити AI обробку
                </button>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Статистика</h2>
            <dl className="space-y-2">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Фото</dt>
                <dd className="text-sm font-medium text-gray-900">{photos.length}</dd>
              </div>
              {brief.ai_layout_plan && (
                <div className="flex items-center justify-between">
                  <dt className="text-sm text-gray-600">Сторінок</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {(brief.ai_layout_plan as any).total_pages}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-600">Вартість послуги</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {order?.designer_service_fee || 0} грн
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
