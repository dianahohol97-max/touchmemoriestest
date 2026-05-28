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

// What each "Ми пишемо" package includes, shown on the brief page so the
// customer can make an informed choice between basic and premium. Each
// package is built from named editorial sections (розділи) — the premium
// tier adds depth (longer, research-backed copy) plus an optional fully
// custom article.
const PACKAGE_DETAILS: Record<Package, {
  tagline: string;
  sections: { title: string; body: string }[];
  footer: string;
}> = {
  basic: {
    tagline: 'Короткі теплі тексти за вашими відповідями. Ідеально як доповнення до фотографій.',
    sections: [
      { title: 'Вступне слово', body: 'Тепле звернення до людини, для якої журнал — задає настрій усьому виданню.' },
      { title: 'Про особистість', body: 'Короткий портрет: характер, улюблені речі, звички, що робить людину особливою.' },
      { title: 'Знак зодіаку', body: 'Опис рис за знаком зодіаку, підібраний під конкретну людину.' },
      { title: 'Про стосунки', body: 'Розділ про дружбу, кохання або сімʼю — на ваш вибір.' },
      { title: 'Улюблені речі', body: 'Список і опис речей, без яких людину неможливо уявити (9 або 12 пунктів).' },
      { title: 'Побажання', body: 'Завершальне слово-побажання від вас або від команди.' },
    ],
    footer: 'Обсяг тексту: короткі підписи та абзаци. Терміни: текст готується до верстки за 2–3 робочі дні.',
  },
  premium: {
    tagline: 'Глибокі, детальні тексти-історії з опрацюванням деталей. Для журналу, який читають як книгу.',
    sections: [
      { title: 'Розгорнутий вступ', body: 'Персональне есе-звернення, написане на основі повної історії людини.' },
      { title: 'Біографія та доля', body: 'Опис за датою, часом і місцем народження — характер, життєвий шлях, сильні сторони.' },
      { title: 'Робота і покликання', body: 'Розділ про професію, досягнення та те, що людина любить у своїй справі.' },
      { title: 'Хобі та подорожі', body: 'Захоплення, улюблені місця, найяскравіші мандрівки та мрії.' },
      { title: 'Характер і стиль', body: 'Глибокий портрет особистості: темперамент, стиль, бренди, естетика.' },
      { title: 'Цікаві факти', body: '3–5 історій, мрій, звичок чи досягнень, оформлених як окремі мініатюри.' },
      { title: '+ Кастомна стаття (опційно)', body: 'Одна повністю індивідуальна стаття на будь-яку тему за вашим запитом.' },
    ],
    footer: 'Обсяг тексту: повноцінні статті та історії. Терміни: текст готується за 4–6 робочих днів.',
  },
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
  // Package is now chosen ON this page (the product card only commits the
  // customer to "Ми пишемо"). If a package arrived in the URL (legacy
  // we-basic / we-premium deep links), use it as the initial selection;
  // otherwise default to 'basic' and let the customer switch.
  const urlPackage: Package = searchParams.get('package') === 'premium' ? 'premium' : 'basic';
  const [pkg, setPkg] = useState<Package>(urlPackage);

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
  // Extra cover-design details so the editor knows exactly how to style
  // the cover: the person's name, the era/epoque to evoke, the visual
  // style, the date to feature, and which uploaded photo to use.
  const [coverName, setCoverName] = useState('');
  const [coverEra, setCoverEra] = useState('');
  const [coverStyle, setCoverStyle] = useState('');
  const [coverDate, setCoverDate] = useState('');
  const [coverPhotoNote, setCoverPhotoNote] = useState('');
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
            coverName ? `Імʼя на обкладинці: ${coverName}` : '',
            coverDate ? `Дата на обкладинці: ${coverDate}` : '',
            coverEra ? `Епоха/настрій: ${coverEra}` : '',
            coverStyle ? `Стиль обкладинки: ${coverStyle}` : '',
            coverPhotoNote ? `Фото на обкладинку: ${coverPhotoNote}` : '',
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
            cover: {
              name: coverName,
              date: coverDate,
              era: coverEra,
              style: coverStyle,
              photo_note: coverPhotoNote,
              inscription: coverInscription,
            },
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
        Оберіть пакет — далі заповніть анкету, і наш редактор напише текст для вашого журналу.
      </p>

      {/* Package chooser: explains the difference between the two
          "Ми пишемо" packages, section by section, and lets the
          customer pick. The selected package drives which brief fields
          are shown below and the price in the summary. */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          Оберіть пакет тексту
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {(['basic', 'premium'] as Package[]).map((p) => {
            const active = pkg === p;
            const details = PACKAGE_DETAILS[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPkg(p)}
                style={{
                  textAlign: 'left',
                  border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: active ? '#f0f3ff' : '#fff',
                  borderRadius: 12,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 800, fontSize: 17, color: '#1e2d7d' }}>
                    {p === 'basic' ? 'Базовий' : 'Преміум'}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: active ? '#1e2d7d' : '#475569', whiteSpace: 'nowrap' }}>
                    {PACKAGE_PRICE[p]} ₴
                  </span>
                </div>
                <p style={{ fontSize: 13, color: '#475569', margin: 0, lineHeight: 1.5 }}>
                  {details.tagline}
                </p>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, marginTop: 2 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 8px' }}>
                    Розділи
                  </p>
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {details.sections.map((sec, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#0f172a', lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 700 }}>{sec.title}.</span>{' '}
                        <span style={{ color: '#64748b' }}>{sec.body}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '6px 0 0', lineHeight: 1.5 }}>
                  {details.footer}
                </p>
                <div style={{
                  marginTop: 6, fontSize: 13, fontWeight: 700,
                  color: active ? '#1e2d7d' : '#94a3b8',
                }}>
                  {active ? '✓ Обрано' : 'Обрати цей пакет'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Section 1: Briefing */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#1e2d7d' }}>
          1. Розкажіть про людину
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          {pkg === 'premium'
            ? 'Преміум-пакет: що детальніше ви опишете людину, то багатшими будуть статті.'
            : 'Базовий пакет: заповніть основне — цього достатньо для теплих коротких текстів.'}
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

        {/* Recommended photo count based on the chosen page count, with
            a +30% upper bound. The page count is carried over from the
            product page in carriedOptions['Кількість сторінок']. We show
            the recommended range and gently warn if the upload count is
            outside it. */}
        {(() => {
          const pagesNum = parseInt(String(carriedOptions['Кількість сторінок'] || '').replace(/[^\d]/g, ''), 10) || 0;
          if (!pagesNum) return null;
          // One photo per page is the baseline; the upper bound is +30%
          // to leave room for variants and collages.
          const recMin = pagesNum;
          const recMax = Math.ceil(pagesNum * 1.3);
          const count = photos.length;
          const ok = count >= recMin && count <= recMax;
          const tooFew = count > 0 && count < recMin;
          const tooMany = count > recMax;
          const bg = count === 0 ? '#eff6ff' : ok ? '#f0fdf4' : '#fef2f2';
          const border = count === 0 ? '#bfdbfe' : ok ? '#bbf7d0' : '#fecaca';
          const titleColor = count === 0 ? '#1e2d7d' : ok ? '#15803d' : '#b91c1c';
          return (
            <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: titleColor }}>
                Рекомендована кількість фото для {pagesNum} сторінок: {recMin}–{recMax}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b', lineHeight: 1.5 }}>
                Орієнтовно одне фото на сторінку. Максимум {recMax} (на 30% більше за рекомендовану кількість) — щоб ми мали з чого обрати найкращі кадри й варіанти.
              </p>
              {count > 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: titleColor }}>
                  {tooFew && `Завантажено ${count} — бажано додати ще щонайменше ${recMin - count}.`}
                  {tooMany && `Завантажено ${count} — це більше за рекомендований максимум (${recMax}). Зайві фото можемо не використати.`}
                  {ok && `Завантажено ${count} — чудово, цього достатньо.`}
                </p>
              )}
            </div>
          );
        })()}

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

      {/* Section 3: Cover */}
      <section style={{ background: '#f8fafc', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#1e2d7d' }}>
          3. Обкладинка
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          Обкладинка задає настрій усього журналу. Розкажіть, якою ви її бачите — ці деталі допоможуть нашому редактору підібрати шрифт, кольори та композицію.
        </p>

        {/* Recommendation box: what makes a good cover photo */}
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 16, marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e2d7d' }}>
            Поради щодо фото на обкладинку
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: 1.6 }}>
            <li>Найкраще — вертикальне фото або таке, що добре кадрується вертикально.</li>
            <li>Обличчя крупно, чіткий фокус, гарне світло.</li>
            <li>Бажано фон без зайвих деталей — на ньому добре читається надпис.</li>
            <li>Висока роздільність (фото з телефону в оригіналі підходить).</li>
          </ul>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Імʼя людини на обкладинці
            </label>
            <input
              type="text"
              value={coverName}
              onChange={(e) => setCoverName(e.target.value)}
              placeholder='наприклад "Марія"'
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
              Дата на обкладинці (опційно)
            </label>
            <input
              type="text"
              value={coverDate}
              onChange={(e) => setCoverDate(e.target.value)}
              placeholder='напр. "1990" або "25 років"'
              style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Епоха / настрій (era)
          </label>
          <input
            type="text"
            value={coverEra}
            onChange={(e) => setCoverEra(e.target.value)}
            placeholder='напр. "вінтаж 90-х", "ретро", "сучасний мінімалізм"'
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Яку атмосферу часу має передавати журнал — це впливає на шрифти й кольори.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Стиль обкладинки (style)
          </label>
          <input
            type="text"
            value={coverStyle}
            onChange={(e) => setCoverStyle(e.target.value)}
            placeholder='напр. "журнальний glossy", "ніжний пастельний", "стильний чорно-білий"'
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Яке фото на обкладинку?
          </label>
          <input
            type="text"
            value={coverPhotoNote}
            onChange={(e) => setCoverPhotoNote(e.target.value)}
            placeholder='опишіть або вкажіть номер фото зі списку вище'
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Якщо вже знаєте, яке з завантажених фото хочете на обкладинку — напишіть тут. Якщо ні — наш редактор підбере найкраще.
          </p>
        </div>

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Надпис на обкладинці
          </label>
          <input
            type="text"
            value={coverInscription}
            onChange={(e) => setCoverInscription(e.target.value)}
            placeholder='наприклад "Книга про Марію" або девіз'
            style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none' }}
          />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Заголовок, який буде на обкладинці. Можна залишити порожнім — тоді використаємо імʼя.
          </p>
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
