'use client';

import { useRouter } from 'next/navigation';
import BriefForm from '@/components/designer-service/BriefForm';
import type { DesignBrief, BriefFormData } from '@/lib/types/designer-service';

interface BriefPageClientProps {
  token: string;
  brief: DesignBrief;
  orderNumber: string;
  customerName: string;
}

export default function BriefPageClient({
  token,
  brief,
  orderNumber,
  customerName,
}: BriefPageClientProps) {
  const router = useRouter();

  async function handleSubmit(formData: BriefFormData) {
    const response = await fetch('/api/designer-service/brief/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, formData }),
    });

    if (!response.ok) {
      throw new Error('Failed to submit brief');
    }

    // Refresh the page to show success message
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Створіть ваш ідеальний фотоальбом
          </h1>
          <p className="text-lg text-gray-600">
            Замовлення #{orderNumber} • {customerName}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-[3px] shadow-md p-8">
          <BriefForm
            token={token}
            orderId={brief.order_id}
            initialPhotos={brief.photos_metadata || []}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-[3px] p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Потрібна допомога?</h3>
          <p className="text-sm text-blue-800 mb-3">
            Якщо у вас виникли питання щодо заповнення брифу або завантаження фото,
            зв'яжіться з нами:
          </p>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>📧 Email: info@touchmemories.com.ua</li>
            <li>📱 Telegram: @touchmemories</li>
            <li>📞 Телефон: +380 XX XXX XX XX</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
