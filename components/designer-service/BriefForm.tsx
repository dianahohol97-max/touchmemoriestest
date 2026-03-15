'use client';

import { useState } from 'react';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import PhotoUploader from './PhotoUploader';
import type {
  BriefFormData,
  DesignOccasion,
  StylePreference,
  PhotoOrder,
  PhotoMetadata,
} from '@/lib/types/designer-service';

interface BriefFormProps {
  token: string;
  orderId: string;
  initialPhotos?: PhotoMetadata[];
  onSubmit: (formData: BriefFormData) => Promise<void>;
}

const occasions: { value: DesignOccasion; label: string; icon: string; description: string }[] = [
  { value: 'wedding', label: 'Весілля', icon: '💒', description: 'Ваш особливий день' },
  { value: 'birthday', label: 'День народження', icon: '🎂', description: 'Святкування життя' },
  { value: 'travel', label: 'Подорож', icon: '✈️', description: 'Спогади з мандрівок' },
  { value: 'family', label: 'Сімейний альбом', icon: '👨‍👩‍👧‍👦', description: 'Наша родина' },
  { value: 'baby', label: 'Дитяча', icon: '👶', description: 'Перший рік життя' },
  { value: 'graduation', label: 'Випускний', icon: '🎓', description: 'Досягнення' },
  { value: 'corporate', label: 'Корпоратив', icon: '🏢', description: 'Команда і події' },
  { value: 'other', label: 'Інше', icon: '📖', description: 'Унікальна подія' },
];

const styles: { value: StylePreference; label: string; description: string; preview: string }[] = [
  {
    value: 'minimal',
    label: 'Мінімалістичний',
    description: 'Чистий, простий, багато білого простору',
    preview: '🤍',
  },
  {
    value: 'bright',
    label: 'Яскравий',
    description: 'Насичені кольори, енергійний, веселий',
    preview: '🌈',
  },
  {
    value: 'classic',
    label: 'Класичний',
    description: 'Елегантний, витончений, традиційний',
    preview: '🎨',
  },
  {
    value: 'romantic',
    label: 'Романтичний',
    description: "Ніжний, м'який, пастельні відтінки",
    preview: '💕',
  },
  {
    value: 'kids',
    label: 'Дитячий',
    description: 'Яскравий, веселий, ігровий',
    preview: '🎈',
  },
];

const photoOrders: { value: PhotoOrder; label: string; description: string }[] = [
  { value: 'chronological', label: 'Хронологічно', description: 'За датою зйомки' },
  { value: 'random', label: 'Випадково', description: 'Дизайнер обере найкращі' },
  { value: 'manual', label: 'Вручну', description: 'Я сам впорядкую фото' },
];

export default function BriefForm({ token, orderId, initialPhotos = [], onSubmit }: BriefFormProps) {
  const [step, setStep] = useState(1);
  const [photos, setPhotos] = useState<PhotoMetadata[]>(initialPhotos);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<BriefFormData>({
    is_gift: false,
    occasion: 'family',
    style_preference: 'classic',
    important_photos: '',
    title_text: '',
    additional_notes: '',
    photo_order: 'chronological',
  });

  const updateField = (field: keyof BriefFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) {
      alert('Будь ласка, завантажте хоча б одне фото');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Submit error:', error);
      alert('Помилка при відправці брифу. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return photos.length > 0;
    if (step === 2) return formData.occasion && formData.style_preference;
    return true;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold
                  transition-colors
                  ${
                    s < step
                      ? 'bg-green-500 text-white'
                      : s === step
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }
                `}
              >
                {s < step ? <Check className="h-5 w-5" /> : s}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  s === step ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                {s === 1 && 'Фото'}
                {s === 2 && 'Бриф'}
                {s === 3 && 'Підтвердження'}
              </span>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 mx-4 ${s < step ? 'bg-green-500' : 'bg-gray-200'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Upload Photos */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Завантажте ваші фото</h2>
            <p className="text-gray-600">
              Оберіть 20-50 найкращих фото для вашого фотоальбому. Наш AI-дизайнер
              проаналізує їх та створить ідеальну розкладку.
            </p>
          </div>

          <PhotoUploader
            token={token}
            orderId={orderId}
            initialPhotos={photos}
            onPhotosChange={setPhotos}
          />
        </div>
      )}

      {/* Step 2: Fill Brief */}
      {step === 2 && (
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Розкажіть про ваш альбом</h2>
            <p className="text-gray-600">
              Ці відповіді допоможуть нам створити ідеальний дизайн саме для вас.
            </p>
          </div>

          {/* Is Gift */}
          <div>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_gift}
                onChange={(e) => updateField('is_gift', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-700 font-medium">Це подарунок?</span>
            </label>
          </div>

          {/* Occasion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Яка подія? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {occasions.map((occasion) => (
                <button
                  key={occasion.value}
                  type="button"
                  onClick={() => updateField('occasion', occasion.value)}
                  className={`
                    p-4 rounded-[3px] border-2 text-left transition-all
                    ${
                      formData.occasion === occasion.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="text-2xl mb-1">{occasion.icon}</div>
                  <div className="font-medium text-sm text-gray-900">{occasion.label}</div>
                  <div className="text-xs text-gray-500">{occasion.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Style Preference */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Який стиль вам подобається? <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {styles.map((style) => (
                <button
                  key={style.value}
                  type="button"
                  onClick={() => updateField('style_preference', style.value)}
                  className={`
                    p-4 rounded-[3px] border-2 text-left transition-all
                    ${
                      formData.style_preference === style.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{style.label}</div>
                      <div className="text-sm text-gray-600 mt-1">{style.description}</div>
                    </div>
                    <div className="text-2xl">{style.preview}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Title Text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Текст на обкладинці (опціонально)
            </label>
            <input
              type="text"
              value={formData.title_text}
              onChange={(e) => updateField('title_text', e.target.value)}
              placeholder='Наприклад: "Наше весілля 2024" або "Сімейні спогади"'
              className="w-full px-4 py-2 border border-gray-300 rounded-[3px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Important Photos */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Є особливі фото, які обов'язково мають бути в альбомі? (опціонально)
            </label>
            <textarea
              value={formData.important_photos}
              onChange={(e) => updateField('important_photos', e.target.value)}
              placeholder="Наприклад: обручки, перший танець, групове фото з усіма гостями"
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-[3px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Photo Order */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Як впорядкувати фото?
            </label>
            <div className="space-y-2">
              {photoOrders.map((order) => (
                <label
                  key={order.value}
                  className="flex items-start p-3 border-2 border-gray-200 rounded-[3px] cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="photo_order"
                    value={order.value}
                    checked={formData.photo_order === order.value}
                    onChange={(e) => updateField('photo_order', e.target.value)}
                    className="mt-1 w-4 h-4 text-blue-600"
                  />
                  <div className="ml-3">
                    <div className="font-medium text-gray-900">{order.label}</div>
                    <div className="text-sm text-gray-600">{order.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Додаткові побажання (опціонально)
            </label>
            <textarea
              value={formData.additional_notes}
              onChange={(e) => updateField('additional_notes', e.target.value)}
              placeholder="Будь-які інші побажання щодо дизайну, кольорів, розташування..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-[3px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Перевірте ваш бриф</h2>
            <p className="text-gray-600">
              Будь ласка, перевірте всю інформацію перед відправкою.
            </p>
          </div>

          <div className="bg-gray-50 rounded-[3px] p-6 space-y-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Кількість фото</div>
              <div className="font-medium">{photos.length} фото</div>
            </div>

            <div>
              <div className="text-sm text-gray-500 mb-1">Подія</div>
              <div className="font-medium">
                {occasions.find((o) => o.value === formData.occasion)?.label}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500 mb-1">Стиль</div>
              <div className="font-medium">
                {styles.find((s) => s.value === formData.style_preference)?.label}
              </div>
            </div>

            {formData.title_text && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Текст на обкладинці</div>
                <div className="font-medium">{formData.title_text}</div>
              </div>
            )}

            {formData.important_photos && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Важливі фото</div>
                <div className="font-medium">{formData.important_photos}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-gray-500 mb-1">Порядок фото</div>
              <div className="font-medium">
                {photoOrders.find((o) => o.value === formData.photo_order)?.label}
              </div>
            </div>

            {formData.additional_notes && (
              <div>
                <div className="text-sm text-gray-500 mb-1">Додаткові побажання</div>
                <div className="font-medium">{formData.additional_notes}</div>
              </div>
            )}

            <div>
              <div className="text-sm text-gray-500 mb-1">Подарунок</div>
              <div className="font-medium">{formData.is_gift ? 'Так' : 'Ні'}</div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-[3px] p-4">
            <p className="text-sm text-blue-800">
              <strong>Що далі?</strong> Після відправки брифу наш AI-дизайнер проаналізує
              ваші фото та створить чернетку дизайну. Потім наш дизайнер доопрацює її та
              надішле вам на перегляд. Ви зможете залишити коментарі та запитати правки.
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-[3px] font-medium
            transition-colors
            ${
              step === 1
                ? 'invisible'
                : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
            }
          `}
        >
          <ChevronLeft className="h-5 w-5" />
          Назад
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-[3px] font-medium
              transition-colors
              ${
                canProceed()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            Далі
            <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`
              px-8 py-3 rounded-[3px] font-medium text-white
              transition-colors
              ${
                submitting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }
            `}
          >
            {submitting ? 'Відправляємо...' : 'Відправити бриф'}
          </button>
        )}
      </div>
    </div>
  );
}
