'use client';
import { useRouter } from 'next/navigation';
import { Book, Plane, FileText, Calendar } from 'lucide-react';

const products = [
  { id: 'photobook', label: 'Фотокнига', href: '/constructor/photobook', icon: Book, color: 'blue' },
  { id: 'travelbook', label: 'Travel Book', href: '/constructor/travelbook', icon: Plane, color: 'green' },
  { id: 'magazine', label: 'Глянцевий журнал', href: '/constructor/magazine', icon: FileText, color: 'purple' },
  { id: 'guestbook', label: 'Гостьова книга', href: '/constructor/guestbook', icon: Book, color: 'orange' },
];

export default function WizardPage() {
  const router = useRouter();

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 border-blue-500',
      green: 'bg-green-50 text-green-600 border-green-500',
      purple: 'bg-purple-50 text-purple-600 border-purple-500',
      orange: 'bg-orange-50 text-orange-600 border-orange-500',
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gradient-to-br from-stone-50 to-amber-50">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-bold text-stone-900 mb-4">
            Оберіть тип продукту
          </h1>
          <p className="text-xl text-stone-600">
            Що ви хочете створити?
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {products.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => router.push(p.href)}
                className="group bg-white p-8 border-2 border-stone-200 rounded-xl hover:border-stone-400 hover:shadow-xl transition-all duration-200 text-left"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-3 rounded-lg ${getColorClasses(p.color)}`}>
                    <Icon className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-stone-900">
                    {p.label}
                  </h2>
                </div>

                <div className="flex items-center justify-center py-3 bg-stone-900 text-white rounded-lg font-semibold group-hover:bg-stone-800 transition-colors">
                  Обрати →
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/catalog')}
            className="text-stone-600 hover:text-stone-900 underline text-sm"
          >
            ← Повернутись до каталогу
          </button>
        </div>
      </div>
    </div>
  );
}
