'use client';
import { deliveryToPaymentRegion } from '@/lib/payment/pricing-region';

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
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';
import { toast, Toaster } from 'react-hot-toast';
import { Upload, X, Check } from 'lucide-react';
import { normalizeImageFile } from '@/lib/heic-to-jpeg';
import { downscaleImageIfLarge } from '@/lib/downscale-image';
import { getMagazinePrice, TYPESETTING_PRICE, URGENT_MULTIPLIER } from '@/lib/products';

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
    footer: 'Обсяг тексту: повноцінні статті та історії. Терміни: текст готується за 2–3 робочі дні.',
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

// Clickable suggestions for the cover brief — customers rarely know what to type
// for "era" / "style", so we offer glossy-magazine presets they can tap (and
// still edit freely). These feed the brief our editor uses to design the cover.
const COVER_ERA_SUGGESTIONS = ['Сучасний', 'Вінтаж', 'Ретро 90-х', 'Голлівуд', 'Романтичний', 'Святковий', 'Драматичний'];
const COVER_STYLE_SUGGESTIONS = ['Fashion / мода', 'Glamour', 'Модель (model)', 'Editorial', 'Beauty', 'Глянцевий яскравий', 'Пастельний ніжний', 'Чорно-білий', 'Мінімалізм'];

function MagazineTextBriefContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const localeMatch = pathname.match(/^\/(uk|en|ro|pl|de)\//);
  const currentLocale = localeMatch ? localeMatch[1] : 'uk';
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
  // Optional dedicated cover photo the customer can upload right here,
  // separate from the journal photo pool. If set, the editor uses this
  // exact image for the cover instead of guessing from the pool.
  const [coverPhoto, setCoverPhoto] = useState<PhotoFile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [telegram, setTelegram] = useState('');
  const [email, setEmail] = useState('');
  const [contactMethod, setContactMethod] = useState<'phone' | 'telegram' | 'email'>('telegram');
  const [submitting, setSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [coverDrag, setCoverDrag] = useState(false);

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

  const handleCoverPhoto = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    if (coverPhoto) URL.revokeObjectURL(coverPhoto.preview);
    setCoverPhoto({
      id: `cover-${Date.now()}`,
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    });
  };

  const removeCoverPhoto = () => {
    if (coverPhoto) URL.revokeObjectURL(coverPhoto.preview);
    setCoverPhoto(null);
  };

  const canSubmit = (): boolean => {
    if (photos.length === 0) return false;
    if (!firstName.trim() || !lastName.trim()) return false;
    // Telegram nick is always required — it's the primary channel we use
    // to reach the customer about the brief. The chosen channel below
    // (if email/phone) is required on top of it.
    if (!telegram.trim()) return false;
    if (contactMethod === 'email' && !email.trim()) return false;
    if (contactMethod === 'phone' && !phone.trim()) return false;
    for (const f of visibleFields) {
      if (f.required && !answers[f.id]?.trim()) return false;
    }
    return true;
  };

  // Human-readable list of what's still missing, so the customer can see
  // why the button is disabled instead of guessing. Shown under the button.
  const missingItems = (): string[] => {
    const out: string[] = [];
    if (photos.length === 0) out.push('додайте хоча б одне фото');
    if (!firstName.trim()) out.push('вкажіть імʼя');
    if (!lastName.trim()) out.push('вкажіть прізвище');
    if (!telegram.trim()) out.push('вкажіть нік у Telegram');
    if (contactMethod === 'email' && !email.trim()) out.push('вкажіть email');
    if (contactMethod === 'phone' && !phone.trim()) out.push('вкажіть номер телефону');
    const missingFields = visibleFields.filter(f => f.required && !answers[f.id]?.trim());
    if (missingFields.length > 0) {
      out.push(`заповніть обовʼязкові поля анкети (${missingFields.length}): ${missingFields.map(f => f.label.split(/[:(]/)[0].trim()).join(', ')}`);
    }
    return out;
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
      // (image content-type normalisation now happens server-side in
      // /api/upload/order-file)
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        try {
          const normalized = await normalizeImageFile(photo.file);
          const fileToUpload = await downscaleImageIfLarge(normalized);
          const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${sessionId}/${String(i + 1).padStart(3, '0')}_${safeName}`;
          // Upload via the server (service role) so RLS never blocks customer
          // uploads — guests and logged-in users alike. Direct browser uploads
          // were hitting "new row violates row-level security policy".
          const fd = new FormData();
          fd.append('file', fileToUpload, safeName);
          fd.append('path', path);
          fd.append('bucket', 'order-files');
          const resp = await fetch('/api/upload/order-file', { method: 'POST', body: fd });
          if (!resp.ok) {
            const j = await resp.json().catch(() => ({}));
            console.error('upload error:', j);
            toast.error(`Не вдалось завантажити ${photo.file.name}: ${j?.error || 'спробуйте ще раз'}`);
            continue;
          }
          uploadedItems.push({
            path,
            name: photo.file.name,
            size: fileToUpload.size,
            type: fileToUpload.type || 'image/jpeg',
          });
        } catch (e: any) {
          // A single bad file (HEIC conversion / downscale failure) must not
          // abort the whole order — skip it and keep going.
          console.error('photo processing error:', e);
          toast.error(`Не вдалось обробити ${photo.file.name}: ${e?.message || 'пропускаємо'}`);
          continue;
        }
      }
      if (uploadedItems.length === 0) {
        toast.error('Не вдалось завантажити жодного фото — спробуйте ще раз');
        setSubmitting(false);
        return;
      }

      // Upload the dedicated cover photo (if any) so the editor can use
      // the exact image the customer picked for the cover.
      let coverPhotoPath: string | null = null;
      if (coverPhoto) {
        try {
          const coverToUpload = await downscaleImageIfLarge(await normalizeImageFile(coverPhoto.file));
          const safeName = coverToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const path = `${sessionId}/cover_${safeName}`;
          const fd = new FormData();
          fd.append('file', coverToUpload, safeName);
          fd.append('path', path);
          fd.append('bucket', 'order-files');
          const resp = await fetch('/api/upload/order-file', { method: 'POST', body: fd });
          if (!resp.ok) {
            const j = await resp.json().catch(() => ({}));
            console.error('cover upload error:', j);
            toast.error(`Не вдалось завантажити обкладинку: ${j?.error || 'спробуйте ще раз'}`);
          } else {
            coverPhotoPath = path;
            uploadedItems.push({
              path,
              name: `[ОБКЛАДИНКА] ${coverPhoto.file.name}`,
              size: coverToUpload.size,
              type: coverToUpload.type || 'image/jpeg',
            });
          }
        } catch (e: any) {
          // Cover photo is optional — never let it abort the order.
          console.error('cover processing error:', e);
          toast.error(`Не вдалось обробити обкладинку: ${e?.message || 'пропускаємо'}`);
        }
      }

      // 2) Create order row. The order used to land with total = 0, so the
      //    admin showed «0 ₴» and a manager had to re-derive the price by
      //    hand — even though this page already computes and SHOWS the
      //    customer «від N ₴». Store that same figure (base + urgency +
      //    text package) with a labeled breakdown; the manager still
      //    confirms it after reading the brief, but starts from a number
      //    instead of a blank.
      const estPagesNum = parseInt(String(carriedOptions['Кількість сторінок'] || '').replace(/[^\d]/g, ''), 10) || 0;
      const estBase = estPagesNum ? (getMagazinePrice(estPagesNum, false) || 0) : 0;
      const estUrgentRaw = String(carriedOptions['Терміновість'] || carriedOptions['urgent'] || '').toLowerCase();
      const estIsUrgent = estUrgentRaw !== '' && estUrgentRaw !== '0' && estUrgentRaw !== 'standard' && !estUrgentRaw.includes('стандартна');
      const estUrgentExtra = estIsUrgent ? Math.round(estBase * URGENT_MULTIPLIER) : 0;
      const estTotal = estBase ? estBase + estUrgentExtra + PACKAGE_PRICE[pkg] : 0;
      const estBreakdown = estBase ? [
        { label: `Базова вартість (${estPagesNum} стор.)`, amount: estBase },
        ...(estUrgentExtra ? [{ label: 'Термінове виготовлення', amount: estUrgentExtra }] : []),
        { label: `Текст пише команда — ${PACKAGE_LABEL[pkg]}`, amount: PACKAGE_PRICE[pkg] },
      ] : [];

      const PRODUCT_NAMES: Record<string, string> = {
        'personalized-glossy-magazine': 'Глянцевий журнал про людину',
      };
      const productName = PRODUCT_NAMES[productSlug]
        || productSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_first_name: firstName,
          customer_last_name: lastName,
          customer_phone: phone,
          customer_email: email || null,
          customer_telegram: telegram || null,
          with_designer: true,
          // order_number comes from the DB sequence default (TM-NNNNNN), read back
          // via .select. delivery_method is still NOT NULL; team confirms later.
          delivery_method: 'pickup',
          items: [{
            product_slug: productSlug,
            product_name: productName,
            quantity: 1,
            unit_price: estTotal,
            total_price: estTotal,
            price_breakdown: estBreakdown,
            text_package: pkg,
            text_package_price: PACKAGE_PRICE[pkg],
            options: carriedOptions,
          }],
          notes: [
            estTotal
              ? `💰 Рахунок виставлено автоматично: ${estTotal} ₴ (база + терміновість + пакет тексту).`
              : '💰 Ціну не пораховано автоматично (немає кількості сторінок) — визначте вручну і надішліть посилання на оплату.',
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
          total: estTotal,
          subtotal: estTotal,
          text_brief: {
            package: pkg,
            answers,
            cover: {
              name: coverName,
              date: coverDate,
              era: coverEra,
              style: coverStyle,
              photo_note: coverPhotoNote,
              photo_path: coverPhotoPath,
              inscription: coverInscription,
            },
            cover_inscription: coverInscription,
            collected_at: new Date().toISOString(),
          },
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      // 3) Link photos to order with full metadata so /admin/orders/
      //    [id]/files shows them with the journal badge. The order already
      //    exists at this point — a linking failure must NOT surface as an
      //    order error (that would make the customer retry and double-order).
      if (order && uploadedItems.length > 0) {
        const { error: filesErr } = await supabase.from('order_files').insert(
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
        if (filesErr) console.error('order_files link error (order still created):', filesErr);
      }

      setOrderId(order.id);
      setOrderNumber(order.order_number);

      // Payment step. The brief used to end at «менеджер звʼяжеться з вами»
      // even though this page computes the exact price (base + urgency +
      // text package) — a manager then re-derived the same number and sent
      // a link by hand. The price is deterministic, so bill it now: create
      // the invoice and send the customer to Monobank, exactly like
      // checkout and the designer flow. If the invoice can't be created
      // (no page count carried, bank error), fall back to the success
      // screen — the manager path and the pay-button email still cover it.
      if (estTotal > 0) {
        try {
          const invoiceRes = await fetch('/api/monobank/create-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: order.id, paymentRegion: deliveryToPaymentRegion('pickup') }),
          });
          const invoiceData = await invoiceRes.json();
          if (invoiceRes.ok && invoiceData.pageUrl) {
            window.location.href = invoiceData.pageUrl;
            return;
          }
        } catch { /* fall through to success screen */ }
      }

      setOrderComplete(true);
      toast.success('Замовлення прийнято! Менеджер звʼяжеться з вами.');
    } catch (err: any) {
      console.error('order error:', err);
      const reason = err?.message || err?.error_description || err?.hint || '';
      toast.error(reason ? `Помилка при оформленні: ${reason}` : 'Помилка при оформленні замовлення. Спробуйте ще раз.');
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
        {orderNumber && (
          <p style={{ color: '#94a3b8', fontSize: 14 }}>Номер замовлення: <strong>{orderNumber}</strong></p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginTop: 32 }}>
          <button onClick={() => router.push(`/${currentLocale}`)} style={{
            padding: '12px 24px', background: '#1e2d7d', color: '#fff',
            border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 16, fontWeight: 600,
          }}>На головну</button>
          {orderNumber && (
            <a href={`/track?order=${encodeURIComponent(orderNumber)}`}
              style={{ color: '#1e2d7d', fontSize: 14, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 4 }}>
              Перевірити статус замовлення
            </a>
          )}
        </div>
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
          // One photo per page is the baseline.
          //   • Basic   — upper bound +30% (room for variants/collages).
          //   • Premium — upper bound = recommended + 10, because the
          //     longer premium articles use more supporting images, so
          //     the editor needs a bigger pool to pick from.
          const recMin = pagesNum + 1; // +1: обкладинка теж потребує фото
          const recMax = (pkg === 'premium' ? pagesNum + 10 : Math.ceil(pagesNum * 1.3)) + 2;
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
                {pkg === 'premium'
                  ? `Орієнтовно одне фото на сторінку. Для Преміум-пакету можна додати до +10 фото понад рекомендовану кількість — статті довші, тож редактору потрібно більше кадрів для добірки.`
                  : `Орієнтовно одне фото на сторінку. Максимум ${recMax} (на 30% більше за рекомендовану кількість) — щоб ми мали з чого обрати найкращі кадри й варіанти.`}
              </p>
              {count > 0 && (
                <p style={{ margin: '8px 0 0', fontSize: 13, fontWeight: 600, color: titleColor }}>
                  {tooFew && `Завантажено ${count} — бажано додати ще щонайменше ${recMin - count}.`}
                  {tooMany && `Завантажено ${count} — це більше за максимум (${recMax}). Зайві фото можемо не використати.`}
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
          onDragOver={(e) => { e.preventDefault(); if (!dragActive) setDragActive(true); }}
          onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
          style={{
            width: '100%', padding: 24,
            border: dragActive ? '2px dashed #1e2d7d' : '2px dashed #cbd5e1', borderRadius: 12,
            background: dragActive ? '#eff6ff' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 8, color: dragActive ? '#1e2d7d' : '#64748b',
            transition: 'background 0.15s, border-color 0.15s, color 0.15s',
          }}
        >
          <Upload size={32} />
          <span style={{ fontWeight: 600 }}>Завантажити фото</span>
          <span style={{ fontSize: 12 }}>можна обрати кілька файлів одразу або перетягнути сюди</span>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {COVER_ERA_SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => setCoverEra(s)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: coverEra === s ? '1px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: coverEra === s ? '#eef1fb' : '#fff',
                  color: coverEra === s ? '#1e2d7d' : '#475569',
                }}>
                {s}
              </button>
            ))}
          </div>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {COVER_STYLE_SUGGESTIONS.map(s => (
              <button key={s} type="button" onClick={() => setCoverStyle(s)}
                style={{
                  padding: '6px 12px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: coverStyle === s ? '1px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: coverStyle === s ? '#eef1fb' : '#fff',
                  color: coverStyle === s ? '#1e2d7d' : '#475569',
                }}>
                {s}
              </button>
            ))}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Стиль обкладинки в дусі глянцю — оберіть варіант або впишіть свій. Це задає вигляд назв і написів на обкладинці.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Фото для обкладинки (опційно)
          </label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleCoverPhoto(e.target.files)}
          />
          {coverPhoto ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative', width: 96, height: 128, borderRadius: 8, overflow: 'hidden', background: '#e2e8f0', flexShrink: 0 }}>
                <img src={coverPhoto.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={removeCoverPhoto}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={14} />
                </button>
              </div>
              <button
                onClick={() => coverInputRef.current?.click()}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #1e2d7d', background: '#fff', color: '#1e2d7d', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Замінити фото
              </button>
            </div>
          ) : (
            <button
              onClick={() => coverInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!coverDrag) setCoverDrag(true); }}
              onDragEnter={(e) => { e.preventDefault(); setCoverDrag(true); }}
              onDragLeave={(e) => { e.preventDefault(); setCoverDrag(false); }}
              onDrop={(e) => { e.preventDefault(); setCoverDrag(false); handleCoverPhoto(e.dataTransfer.files); }}
              style={{
                width: '100%', padding: 20,
                border: coverDrag ? '2px dashed #1e2d7d' : '2px dashed #cbd5e1', borderRadius: 10,
                background: coverDrag ? '#eff6ff' : '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 6, color: coverDrag ? '#1e2d7d' : '#64748b',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
            >
              <Upload size={24} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Завантажити фото обкладинки</span>
              <span style={{ fontSize: 12 }}>вертикальне фото, обличчя крупно</span>
            </button>
          )}
          <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
            Можна завантажити окреме фото саме для обкладинки. Якщо не завантажите — редактор підбере найкраще із завантажених журнальних фото.
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            Або опишіть, яке фото на обкладинку
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
          type="tel" placeholder={contactMethod === 'phone' ? 'Номер телефону *' : 'Номер телефону'}
          value={phone} onChange={(e) => setPhone(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }}
        />
        <input
          type="text" placeholder="Нік в Telegram *"
          value={telegram} onChange={(e) => setTelegram(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 12 }}
        />
        <input
          type="email" placeholder={contactMethod === 'email' ? 'Email *' : 'Email'}
          value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, outline: 'none', marginBottom: 16 }}
        />

        <div>
          <label style={{ display: 'block', fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Як вам зручніше звʼязатись?</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {([
              { id: 'telegram', label: 'Telegram' },
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

      {/* Estimated total — shown as "від N ₴" because the final price
          depends on layout complexity. Computed the same way as the
          product page: base magazine price for the page count, × urgency
          if chosen, + the text package price. */}
      {(() => {
        const pagesNum = parseInt(String(carriedOptions['Кількість сторінок'] || '').replace(/[^\d]/g, ''), 10) || 0;
        if (!pagesNum) return null;
        const base = getMagazinePrice(pagesNum, false) || 0;
        if (!base) return null;
        const urgentRaw = String(carriedOptions['Терміновість'] || carriedOptions['urgent'] || '').toLowerCase();
        const isUrgent = urgentRaw !== '' && urgentRaw !== '0' && urgentRaw !== 'standard' && !urgentRaw.includes('стандартна');
        let total = base;
        if (isUrgent) total = Math.round(total * (1 + URGENT_MULTIPLIER));
        total += PACKAGE_PRICE[pkg];
        return (
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, color: '#475569', fontWeight: 600 }}>Орієнтовна вартість</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>
                Фінальна ціна залежить від складності макету. Менеджер підтвердить її після перегляду анкети.
              </p>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e2d7d', whiteSpace: 'nowrap' }}>
              від {total} ₴
            </div>
          </div>
        );
      })()}

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
      {!canSubmit() && !submitting && missingItems().length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '12px 16px', marginTop: 12 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>Щоб відправити, залишилось:</p>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, color: '#b91c1c' }}>
            {missingItems().map((m, i) => (<li key={i} style={{ marginBottom: 2 }}>{m}</li>))}
          </ul>
        </div>
      )}
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
