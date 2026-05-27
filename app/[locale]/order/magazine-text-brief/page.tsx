'use client';

// Magazine "we write the text" flow. Customer landed here from the
// product page after picking the "Ми пишемо — Базовий" or "Ми пишемо
// — Преміум" variant of the "Верстка тексту" option on the journal
// product. There's no constructor here on purpose — the designer
// will lay out the journal based on the answers + photos collected
// on this page.
//
// Three sections in one form:
//   1. Briefing questionnaire (10 fields for basic, 13 for premium —
//      content mirrors the original Google Forms that Diana used)
//   2. Photos upload (drag/drop or click) → Supabase Storage
//   3. Cover inscription + customer contact + delivery + payment
//
// Submit creates an order row with text_brief jsonb populated and
// links the uploaded photos via order_files with product_type
// 'journal' + file_category 'magazine-text-brief' so the manager
// view shows everything in one place.

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { toast, Toaster } from 'react-hot-toast';
import { Upload, X, Check } from 'lucide-react';

type Package = 'basic' | 'premium';

// Fields used to render the questionnaire dynamically. Each field
// belongs to one or both packages. Keeping them in a single list
// rather than two separate forms means a future change to the
// briefing content can be made in one place.
const FIELDS: Array<{
  id: string;
  label: string;
  packages: Package[];
  required?: boolean;
  multiline?: boolean;
  type?: 'text' | 'date';
}> = [
  // Common (both packages)
  { id: 'recipient_name',  label: 'Імʼя того, для кого журнал',                                                                packages: ['basic', 'premium'], required: true },
  { id: 'from',            label: 'Від кого журнал (можна не вказувати)',                                                       packages: ['basic'] },
  { id: 'birth_place',     label: 'Місто, де народилась людина, для якої журнал',                                                packages: ['basic'], required: true },
  { id: 'birth_date',      label: 'Дата народження',                                                                              packages: ['basic'], required: true, type: 'date' },
  { id: 'favourite_things',label: 'Улюблені речі',                                                                                packages: ['basic'] },
  { id: 'habit',           label: 'Маленька звичка або ритуал',                                                                  packages: ['basic'] },
  { id: 'superpower_basic',label: 'У чому суперсила людини',                                                                      packages: ['basic'] },
  { id: 'sections',        label: 'Які статті додаємо (можна обрати кілька): про дружбу, про кохання, про сімʼю, про знак зодіаку, про улюблені речі', packages: ['basic'], required: true, multiline: true },
  { id: 'things_list',     label: 'Опишіть речі без яких не уявляєте людину (9 або 12 загалом)',                                  packages: ['basic'], multiline: true },

  // Premium-only (mirrors the longer Google Form)
  { id: 'fullname',        label: 'Імʼя та прізвище людини',                                                                       packages: ['premium'], required: true },
  { id: 'birth_full',      label: 'Дата народження, точний час народження і місто',                                                packages: ['premium'], required: true, multiline: true },
  { id: 'work',            label: 'Чим займається, ким працює, що любить у роботі',                                                packages: ['premium'], required: true, multiline: true },
  { id: 'hobbies',         label: 'Хобі, захоплення, як любить проводити вільний час',                                              packages: ['premium'], required: true, multiline: true },
  { id: 'travel',          label: 'Куди любить подорожувати, куди хоче, найзапамʼятніша подорож',                                   packages: ['premium'], required: true, multiline: true },
  { id: 'character',       label: 'Характер: інтроверт чи екстраверт, що відрізняє, що ви в ньому/ній любите',                       packages: ['premium'], required: true, multiline: true },
  { id: 'style',           label: 'Стиль одягу, кольори, бренди, улюблені магазини',                                                packages: ['premium'], required: true, multiline: true },
  { id: 'facts',           label: '3–5 цікавих фактів: історії, мрії, звички, досягнення',                                          packages: ['premium'], required: true, multiline: true },
  { id: 'associations',    label: 'Асоціації: 1) колір 2) пора року 3) місто 4) фільм 5) пісня 6) тварина 7) квітка 8) напій 9) настрій 10) естетика', packages: ['premium'], required: true, multiline: true },
  { id: 'dream',           label: 'Про що мріє',                                                                                    packages: ['premium'], required: true, multiline: true },
  { id: 'food',            label: 'Що любить їсти або готувати, улюблений напій, улюблена кавʼярня',                                packages: ['premium'], required: true, multiline: true },
  { id: 'superpower_prem', label: 'У чому її/його сила',                                                                              packages: ['premium'], required: true, multiline: true },
  { id: 'extra_article',   label: 'Якщо хочете додати 1 персоналізовану статтю — напишіть про що (опційно)',                       packages: ['premium'], multiline: true },
];

const PACKAGE_PRICE: Record<Package, number> = { basic: 195, premium: 395 };
const PACKAGE_LABEL: Record<Package, string> = {
  basic: 'Базовий пакет — 6 розділів',
  premium: 'Преміум пакет — 6 розділів + опція кастомної статті',
};

interface PhotoFile {
  id: string;
  file: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  storagePath?: string;
}

function MagazineTextBriefContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productSlug = searchParams.get('product') || 'personalized-glossy-magazine';
  const pkg: Package = (searchParams.get('package') === 'premium' ? 'premium' : 'basic');

  // Other product options carried over from the catalog page
  // (Кількість сторінок, Терміновість etc.) so we can show an
  // approximate total in the summary. These are not editable here.
  const carriedOptions: Record<string, string> = {};
  searchParams.forEach((v, k) => {
    if (k !== 'product' && k !== 'package') carriedOptions[k] = v;
  });

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [coverInscription, setCoverInscription] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState('');
  const [contactMethod, setContactMethod] = useState<'phone' | 'telegram' | 'email'>('telegram');
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleFields = FIELDS.filter(f => f.packages.includes(pkg));

  const setAnswer = (id: string, val: string) =>
    setAnswers(prev => ({ ...prev, [id]: val }));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newPhotos: PhotoFile[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      newPhotos.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
        uploading: false,
        uploaded: false,
      });
    });
    if (newPhotos.length > 0) setPhotos(prev => [...prev, ...newPhotos]);
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter(p => p.id !== id);
    });
  };

  const canSubmit = (): boolean => {
    if (photos.length === 0) return false;
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) return false;
    for (const f of visibleFields) {
      if (f.required && !answers[f.id]?.trim()) return false;
    }
    return true;
  };

  const submit = async () => {
    if (!canSubmit()) {
      toast.error('Заповніть обовʼязкові поля та додайте хоча б одне фото');
      return;
    }
    setSubmitting(true);
    try {
      // 1) Upload photos to Supabase Storage. Paths are relative to
      //    the bucket; previous designer-flow had a double-prefix bug
      //    that we don't repeat here.
      const sessionId = `magazine-brief-${Date.now()}`;
      const uploadedItems: Array<{ path: string; name: string; size: number; type: string }> = [];
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const safeName = photo.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${sessionId}/${String(i + 1).padStart(3, '0')}_${safeName}`;
        const { error } = await supabase.storage
          .from('order-files')
          .upload(path, photo.file, { upsert: true });
        if (error) {
          console.error('upload error:', error);
          toast.error(`Не вдалось завантажити ${photo.file.name}`);
          continue;
        }
        uploadedItems.push({
          path,
          name: photo.file.name,
          size: photo.file.size,
          type: photo.file.type || 'image/jpeg',
        });
      }
      if (uploadedItems.length === 0) {
        toast.error('Не вдалось завантажити жодного фото — спробуйте ще раз');
        setSubmitting(false);
        return;
      }

      // 2) Create order row. Total price is left at 0 — the manager
      //    will compute it after reviewing brief + photos (same
      //    pattern as the designer-flow).
      const productName = productSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_first_name: firstName,
          customer_last_name: lastName,
          customer_phone: phone,
          customer_email: email || null,
          customer_telegram: telegram || null,
          with_designer: true,
          items: [{
            product_slug: productSlug,
            product_name: productName,
            quantity: 1,
            text_package: pkg,
            text_package_price: PACKAGE_PRICE[pkg],
            options: carriedOptions,
          }],
          notes: [
            `Текст пише команда — пакет: ${PACKAGE_LABEL[pkg]}`,
            coverInscription ? `Надпис на обкладинці: ${coverInscription}` : '',
          ].filter(Boolean).join('\n---\n'),
          order_status: 'new',
          payment_status: 'pending',
          // orders table uses `total` (not total_price) and has no
          // contact_method column — store the contact preference inside
          // custom_attributes so it's still surfaced for the manager.
          custom_attributes: { contact_method: contactMethod },
          total: 0,
          text_brief: {
            package: pkg,
            answers,
            cover_inscription: coverInscription,
            collected_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // 3) Link photos to order with full metadata so /admin/orders/
      //    [id]/files shows them with the journal badge.
      if (order && uploadedItems.length > 0) {
        await supabase.from('order_files').insert(
          uploadedItems.map((it, idx) => ({
            order_id: order.id,
            file_path: it.path,
            file_name: it.name,
            file_type: 'upload',
            file_category: 'magazine-text-brief',
            product_type: 'journal',
            bucket_name: 'order-files',
            file_size: it.size,
            mime_type: it.type,
            page_number: idx + 1,
          }))
        );
      }

      setOrderId(order.id);
      setOrderComplete(true);
      toast.success('Замовлення прийнято! Менеджер звʼяжеться з вами.');
    } catch (err: any) {
      console.error('order error:', err);
      toast.error('Помилка при оформленні замовлення. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cleanup blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (orderComplete) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
          <Check size={40} color="#16a34a" />
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Замовлення прийнято!</h1>
        <p style={{ color: '#475569', marginBottom: 8 }}>
          Дякуємо! Наш менеджер звʼяжеться з вами найближчим часом для уточнення деталей та підтвердження замовлення.
        </p>
        {orderId && (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Номер замовлення: {orderId.slice(0, 8)}</p>
        )}
        <button onClick={() => router.push('/uk')} style={{
          marginTop: 32, padding: '12px 24px', background: '#1e2d7d', color: '#fff',
          border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600,
        }}>На головну</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '32px 20px' }}>
      <Toaster position="top-center" />

      {/* Header */}
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#1e2d7d', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}>
        ← Назад
      </button>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 8 }}>
        Замовлення журналу з нашим текстом
      </h1>
      <p style={{ color: '#475569', marginBottom: 24 }}>
        {PACKAGE_LABEL[pkg]} · {PACKAGE_PRICE[pkg]} ₴
      </p>

      {/* Section 1: Briefing */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          1. Розкажіть про людину
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          Заповніть, будь ласка, максимально детально — це допоможе створити справді персональний журнал.
        </p>

        {visibleFields.map(field => (
          <div key={field.id} style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6, color: '#0f172a' }}>
              {field.label} {field.required && <span style={{ color: '#dc2626' }}>*</span>}
            </label>
            {field.multiline ? (
              <textarea
                value={answers[field.id] || ''}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                rows={3}
                style={{
                  width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0',
                  fontSize: 14, fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                }}
              />
            ) : field.type === 'date' ? (
              <input
                type="date"
                value={answers[field.id] || ''}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
              />
            ) : (
              <input
                type="text"
                value={answers[field.id] || ''}
                onChange={(e) => setAnswer(field.id, e.target.value)}
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
              />
            )}
          </div>
        ))}
      </section>

      {/* Section 2: Photos */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          2. Фото для журналу
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 16 }}>
          Завантажте фото, які ми використаємо при верстці. Чим більше — тим краще можна підібрати композицію.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            width: '100%', padding: 24, border: '2px dashed #cbd5e1', borderRadius: 12,
            background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, color: '#64748b',
          }}
        >
          <Upload size={32} />
          <span style={{ fontWeight: 600 }}>Завантажити фото</span>
          <span style={{ fontSize: 12 }}>можна обрати кілька файлів одразу</span>
        </button>

        {photos.length > 0 && (
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
            {photos.map(photo => (
              <div key={photo.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#e2e8f0' }}>
                <img src={photo.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => removePhoto(photo.id)}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Cover + contact */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          3. Обкладинка
        </h2>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Який надпис хочете на обкладинці?
          </label>
          <input
            type="text"
            value={coverInscription}
            onChange={(e) => setCoverInscription(e.target.value)}
            placeholder='наприклад "Книга про Марію" або імʼя'
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
        </div>
      </section>

      {/* Section 4: Contact details */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          4. Ваші контактні дані
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <input
            type="text" placeholder="Імʼя *"
            value={firstName} onChange={(e) => setFirstName(e.target.value)}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <input
            type="text" placeholder="Прізвище *"
            value={lastName} onChange={(e) => setLastName(e.target.value)}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
        </div>
        <input
          type="tel" placeholder="Номер телефону *"
          value={phone} onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }}
        />
        <input
          type="text" placeholder="Нік в Telegram (бажано)"
          value={telegram} onChange={(e) => setTelegram(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }}
        />
        <input
          type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16 }}
        />

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Як вам зручніше звʼязатись?</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'telegram', label: 'Telegram' },
              { id: 'phone', label: 'Телефон' },
              { id: 'email', label: 'Email' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setContactMethod(opt.id)}
                style={{
                  padding: '8px 16px', borderRadius: 6,
                  border: contactMethod === opt.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: contactMethod === opt.id ? '#f0f3ff' : '#fff',
                  color: contactMethod === opt.id ? '#1e2d7d' : '#475569',
                  cursor: 'pointer', fontWeight: 600, fontSize: 13,
                }}>{opt.label}</button>
            ))}
          </div>
        </div>
      </section>

      <button
        onClick={submit}
        disabled={submitting || !canSubmit()}
        style={{
          width: '100%', padding: 18, background: canSubmit() && !submitting ? '#1e2d7d' : '#cbd5e1',
          color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
          cursor: canSubmit() && !submitting ? 'pointer' : 'not-allowed',
        }}
      >
        {submitting ? 'Відправляємо…' : 'Відправити замовлення'}
      </button>
      <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginTop: 12 }}>
        Після відправки менеджер уточнить деталі та підтвердить вартість.
      </p>
    </div>
  );
}

// useSearchParams() forces a client-side render boundary; Next.js
// requires the component that uses it to live inside <Suspense>.
// The fallback is intentionally minimal — the page itself is short
// enough that a brief flash of "Завантаження…" is fine.
export default function MagazineTextBriefPage() {
  return (
    <Suspense fallback={
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '40px 20px', textAlign: 'center', color: '#64748b' }}>
        Завантаження…
      </div>
    }>
      <MagazineTextBriefContent />
    </Suspense>
  );
}
