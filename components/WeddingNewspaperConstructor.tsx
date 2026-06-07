'use client';
import { uploadImageToStorage } from '@/lib/storage-upload';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/store/cart-store';
import { toast } from 'sonner';
import { ShoppingCart, Upload, X, Check } from 'lucide-react';

// ─── Per-design questionnaire config ────────────────────────────────────────
// Each design has its own text fields and its own ordered list of labelled
// photo slots (one photo per slot). The photo count = photoSlots.length
// (Design 1 → 11, Design 2 → 6), exactly matching the two layouts.

type FieldType = 'text' | 'textarea';
interface FieldDef { key: string; label: string; type: FieldType; placeholder?: string; required?: boolean; defaultValue?: string; }
interface SlotDef { key: string; label: string; caption?: boolean; }
interface DesignDef {
  id: 'wedding-times' | 'wedding-post';
  name: string;
  tagline: string;
  fields: FieldDef[];
  slots: SlotDef[];
}

const DESIGNS: DesignDef[] = [
  {
    id: 'wedding-times',
    name: 'Дизайн 1 — The Wedding Times',
    tagline: 'Класична газета, акцент на фото — 11 фото',
    fields: [
      { key: 'names',          label: 'Імена пари',                       type: 'text',     placeholder: 'Адріан & Діана', required: true },
      { key: 'city',           label: 'Місто весілля',                    type: 'text',     placeholder: 'Київ',           required: true },
      { key: 'date',           label: 'Місяць і рік весілля',             type: 'text',     placeholder: 'Липень, 2025',   required: true },
      { key: 'weekday',        label: 'День тижня',                       type: 'text',     placeholder: 'Субота',         required: true },
      { key: 'story_met',      label: 'Як ми знайшли один одного (історія знайомства)', type: 'textarea', placeholder: 'Де, коли і як ви познайомились, ключові моменти…', required: true },
      { key: 'story_proposal', label: 'День, коли він зробив пропозицію', type: 'textarea', placeholder: 'Як і де відбулася пропозиція…', required: true },
      { key: 'words',          label: 'Гра в слова — свої слова (необов’язково, через кому)', type: 'textarea', placeholder: 'Лишіть порожнім, щоб використати стандартний весільний набір', required: false },
    ],
    slots: [
      { key: 'cover',        label: 'Обкладинка — головне фото пари (вертикальне)' },
      { key: 'story_kiss',   label: 'Історія — спільне фото (напр. поцілунок)' },
      { key: 'story_detail', label: 'Історія — фото-деталь (руки з каблучкою)' },
      { key: 'grid1',        label: 'Сітка спогадів 1', caption: true },
      { key: 'grid2',        label: 'Сітка спогадів 2', caption: true },
      { key: 'grid3',        label: 'Сітка спогадів 3', caption: true },
      { key: 'grid4',        label: 'Сітка спогадів 4', caption: true },
      { key: 'grid5',        label: 'Сітка спогадів 5', caption: true },
      { key: 'grid6',        label: 'Сітка спогадів 6', caption: true },
      { key: 'final_top',    label: 'Фінал — фото зверху' },
      { key: 'final_big',    label: 'Фінал — велике фото знизу' },
    ],
  },
  {
    id: 'wedding-post',
    name: 'Дизайн 2 — Wedding Post',
    tagline: 'Елегантна газета, історія + цифри — 6 фото',
    fields: [
      { key: 'names',         label: 'Імена пари',             type: 'text',     placeholder: 'Тетяна & Євген',          required: true },
      { key: 'date',          label: 'Дата весілля',           type: 'text',     placeholder: 'Субота, 23 серпня 2025',  required: true },
      { key: 'headline',      label: 'Головний заголовок',     type: 'text',     placeholder: 'ДВА СЕРЦЯ, ОДНА ІСТОРІЯ', required: true, defaultValue: 'ДВА СЕРЦЯ, ОДНА ІСТОРІЯ' },
      { key: 'note',          label: 'Записка від молодят (звернення до гостей)', type: 'textarea', placeholder: 'Подяка гостям за присутність…', required: true },
      { key: 'story',         label: 'Наша історія кохання',   type: 'textarea', placeholder: 'Історія вашої пари…',     required: true },
      { key: 'date_met',      label: 'Перша зустріч — дата',   type: 'text',     placeholder: 'Вересень 06, 2019', required: true },
      { key: 'date_first',    label: 'Перше побачення — дата', type: 'text',     placeholder: 'Вересень 30, 2019', required: true },
      { key: 'date_proposal', label: 'Пропозиція — дата',      type: 'text',     placeholder: 'Серпень 28, 2024',  required: true },
      { key: 'num_dating',    label: 'Скільки днів разом',     type: 'text',     placeholder: '1500', required: true },
      { key: 'num_engaged',   label: 'Скільки днів заручені',  type: 'text',     placeholder: '328',  required: true },
      { key: 'num_planning',  label: 'Скільки днів планування',type: 'text',     placeholder: '8',    required: true },
      { key: 'num_dresses',   label: 'Скільки суконь приміряно', type: 'text',   placeholder: '8',    required: true },
      { key: 'num_cakes',     label: 'Скільки тортів спробувано', type: 'text',  placeholder: '12',   required: true },
      { key: 'fact1',         label: 'Цікавий факт про пару 1', type: 'text',    placeholder: 'Напр. де познайомились', required: true },
      { key: 'fact2',         label: 'Цікавий факт про пару 2', type: 'text',    placeholder: 'Напр. улюблена подорож', required: true },
      { key: 'fact3',         label: 'Цікавий факт про пару 3', type: 'text',    placeholder: 'Напр. хобі кожного',     required: true },
      { key: 'fact4',         label: 'Цікавий факт про пару 4', type: 'text',    placeholder: 'Напр. у чому не сходитесь', required: true },
    ],
    slots: [
      { key: 'cover',        label: 'Обкладинка — головне фото пари (вертикальне)' },
      { key: 'p2_foreheads', label: 'Сторінка 2 — фото (напр. лоби разом)' },
      { key: 'p2_car',       label: 'Сторінка 2 — фото (напр. біля авто)' },
      { key: 'p3',           label: 'Сторінка 3 — фото' },
      { key: 'final_top',    label: 'Фінал — фото зверху' },
      { key: 'final_big',    label: 'Фінал — велике фото знизу' },
    ],
  },
];

interface SlotState { file?: File; previewUrl?: string; path?: string; fileName?: string; size?: number; uploading?: boolean; }

const BTN = (active: boolean): React.CSSProperties => ({
  padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
  border: active ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
  background: active ? '#f0f3ff' : '#fff', color: active ? '#1e2d7d' : '#374151',
  transition: 'all 0.15s',
});
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, outline: 'none', background: '#fff',
};

export default function WeddingNewspaperConstructor() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || 'uk';
  const supabase = useMemo(() => createClient(), []);
  const { addItem } = useCartStore();

  // Stable id shared by every photo upload and the eventual cart item, so the
  // /checkout step can find this item's stashed exports under export_{id}.
  const cartItemId = useRef(`wedding-newspaper_${Date.now()}`).current;

  const [product, setProduct] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [designId, setDesignId] = useState<DesignDef['id'] | ''>('');
  const [copies, setCopies] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [slots, setSlots] = useState<Record<string, SlotState>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const design = DESIGNS.find(d => d.id === designId) || null;

  // Load the product (price + "Кількість примірників" options) by slug.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('products')
        .select('id, name, price, options, images').eq('slug', 'wedding-newspaper').single();
      if (data) {
        setProduct(data);
        const copyOpt = (data.options as any[])?.find((o: any) => o.name === 'Кількість примірників');
        const first = copyOpt?.options?.[0]?.value;
        if (first != null) setCopies(String(first));
      }
    })();
  }, [supabase]);

  // When switching design, seed default field values and reset captions.
  useEffect(() => {
    if (!design) return;
    setFieldValues(prev => {
      const next = { ...prev };
      design.fields.forEach(f => { if (next[f.key] === undefined) next[f.key] = f.defaultValue || ''; });
      return next;
    });
  }, [design]);

  const copyOption = (product?.options as any[])?.find((o: any) => o.name === 'Кількість примірників');
  const copyChoices: { label: string; value: string; price: number }[] = (copyOption?.options || []).map((o: any) => ({
    label: o.label, value: String(o.value), price: Number(o.price || 0),
  }));
  const selectedCopy = copyChoices.find(c => c.value === copies);
  const copiesOk = copyChoices.length === 0 || !!copies;
  const totalPrice = (Number(product?.price) || 0) + (selectedCopy?.price || 0);

  const setField = (key: string, val: string) => setFieldValues(p => ({ ...p, [key]: val }));

  // ── Photo upload (one file per labelled slot) ──────────────────────────────
  const handleFile = async (slotKey: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Можна завантажувати лише зображення'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.error('Файл завеликий (макс. 25 МБ)'); return; }
    const previewUrl = URL.createObjectURL(file);
    setSlots(p => ({ ...p, [slotKey]: { ...p[slotKey], file, previewUrl, uploading: true, path: undefined } }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userKey = user?.id || 'anon';
      const ext = (file.name.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '') || 'jpg';
      const slotIdx = (design?.slots.findIndex(s => s.key === slotKey) ?? 0) + 1;
      const fileName = `${String(slotIdx).padStart(2, '0')}_${slotKey}.${ext}`;
      const path = `${userKey}/${cartItemId}/${fileName}`;
      const { error, file: up } = await uploadImageToStorage(supabase, 'order-files', path, file, { downscale: true, cacheControl: '31536000' });
      if (error) throw error;
      setSlots(p => ({ ...p, [slotKey]: { ...p[slotKey], path, fileName, size: up.size, uploading: false } }));
    } catch (e: any) {
      toast.error(`Помилка завантаження: ${e?.message || 'спробуйте ще раз'}`);
      setSlots(p => ({ ...p, [slotKey]: { ...p[slotKey], uploading: false } }));
    }
  };

  const removeSlot = (slotKey: string) => {
    setSlots(p => { const n = { ...p }; if (n[slotKey]?.previewUrl) { try { URL.revokeObjectURL(n[slotKey].previewUrl!); } catch {} } delete n[slotKey]; return n; });
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const fieldsOk = !!design && design.fields.every(f => !f.required || (fieldValues[f.key] || '').trim().length > 0);
  const uploadedCount = design ? design.slots.filter(s => slots[s.key]?.path).length : 0;
  const photosOk = !!design && uploadedCount === design.slots.length && design.slots.every(s => !slots[s.key]?.uploading);
  const canSubmit = !!design && copiesOk && fieldsOk && photosOk && !submitting;

  // ── Add to cart ──────────────────────────────────────────────────────────────
  const handleAddToCart = () => {
    if (!design || !product) return;
    if (!fieldsOk) { toast.error('Заповніть усі обовʼязкові поля'); setStep(2); return; }
    if (!photosOk) { toast.error(`Завантажте всі ${design.slots.length} фото`); setStep(3); return; }

    // Human-readable answers for the admin order view (the designer reads these).
    const options: Record<string, string> = {
      'Дизайн': design.name,
      ...(selectedCopy ? { 'Кількість примірників': selectedCopy.label } : {}),
    };
    design.fields.forEach(f => { const v = (fieldValues[f.key] || '').trim(); if (v) options[f.label] = v; });
    design.slots.forEach(s => { if (s.caption) { const c = (captions[s.key] || '').trim(); if (c) options[`Підпис: ${s.label}`] = c; } });

    // Photos → order-files records, linked to the order at /checkout.
    const exportedFiles = design.slots
      .map((s, i) => { const st = slots[s.key]; if (!st?.path) return null; return {
        path: st.path, fileName: st.fileName, bucket: 'order-files',
        fileCategory: 'wedding-newspaper', productType: 'wedding-newspaper',
        fileType: 'export', size: st.size, mimeType: st.file?.type || 'image/jpeg', pageNumber: i + 1,
      }; })
      .filter(Boolean);
    try { sessionStorage.setItem(`export_${cartItemId}`, JSON.stringify(exportedFiles)); } catch {}

    const noteParts = design.slots.map((s, i) => `${i + 1}. ${s.label}${s.caption && captions[s.key]?.trim() ? ` — підпис: "${captions[s.key].trim()}"` : ''}`);

    addItem({
      id: cartItemId,
      product_id: product.id,
      name: `Весільна газета — ${design.name}`,
      price: totalPrice,
      qty: 1,
      image: product.images?.[0] || '',
      category_slug: 'wedding-newspaper',
      payment_mode: 'full_only',
      options,
      personalization_note: `${design.name}. ${design.slots.length} фото:\n${noteParts.join('\n')}`,
      metadata: { design: design.id, copies, fields: fieldValues, captions },
    });

    toast.success('Газету додано до кошика');
    router.push(`/${locale}/cart`);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const StepDots = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
      {[1, 2, 3].map(s => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 13, background: s < step ? '#10b981' : s === step ? '#1e2d7d' : '#e2e8f0', color: s <= step ? '#fff' : '#94a3b8' }}>
            {s < step ? <Check size={16} /> : s}
          </div>
          {s < 3 && <div style={{ width: 36, height: 2, background: s < step ? '#10b981' : '#e2e8f0' }} />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-primary, sans-serif)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>Весільна газета</h1>
      <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>
        Оберіть дизайн, заповніть анкету і завантажте фото — далі дизайнер збере вашу газету.
      </p>

      <StepDots />

      {/* Step 1 — design + copies */}
      {step === 1 && (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: '#1e2d7d', marginBottom: 12 }}>Оберіть дизайн</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 24 }}>
            {DESIGNS.map(d => (
              <button key={d.id} onClick={() => setDesignId(d.id)}
                style={{ textAlign: 'left', padding: 16, borderRadius: 10, cursor: 'pointer',
                  border: designId === d.id ? '2px solid #1e2d7d' : '1px solid #e2e8f0',
                  background: designId === d.id ? '#f0f3ff' : '#fff', transition: 'all 0.15s' }}>
                <div style={{ fontWeight: 800, color: '#1e2d7d', marginBottom: 4 }}>{d.name}</div>
                <div style={{ fontSize: 13, color: '#64748b' }}>{d.tagline}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{d.slots.length} фото · {d.fields.filter(f => f.required).length} полів анкети</div>
              </button>
            ))}
          </div>

          {copyChoices.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 8 }}>Кількість примірників</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {copyChoices.map(c => (
                  <button key={c.value} onClick={() => setCopies(c.value)} style={BTN(copies === c.value)}>{c.label}</button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => design && setStep(2)} disabled={!design || !copiesOk}
            style={{ padding: '12px 20px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 15,
              background: design && copiesOk ? '#1e2d7d' : '#e2e8f0', color: design && copiesOk ? '#fff' : '#94a3b8',
              cursor: design && copiesOk ? 'pointer' : 'not-allowed' }}>
            Далі — заповнити анкету →
          </button>
        </div>
      )}

      {/* Step 2 — fields */}
      {step === 2 && design && (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: '#1e2d7d', marginBottom: 12 }}>Анкета — {design.name}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {design.fields.map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontWeight: 700, fontSize: 13, color: '#374151', marginBottom: 5 }}>
                  {f.label}{f.required && <span style={{ color: '#e53e3e' }}> *</span>}
                </label>
                {f.type === 'textarea'
                  ? <textarea value={fieldValues[f.key] || ''} onChange={e => setField(f.key, e.target.value)} placeholder={f.placeholder} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
                  : <input type="text" value={fieldValues[f.key] || ''} onChange={e => setField(f.key, e.target.value)} placeholder={f.placeholder} style={inputStyle} />}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={() => setStep(1)} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer', color: '#374151' }}>← Назад</button>
            <button onClick={() => { if (!fieldsOk) { toast.error('Заповніть усі обовʼязкові поля'); return; } setStep(3); }}
              style={{ padding: '12px 20px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 15,
                background: fieldsOk ? '#1e2d7d' : '#e2e8f0', color: fieldsOk ? '#fff' : '#94a3b8', cursor: fieldsOk ? 'pointer' : 'not-allowed' }}>
              Далі — завантажити фото →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — photos + submit */}
      {step === 3 && design && (
        <div>
          <h3 style={{ fontWeight: 800, fontSize: 16, color: '#1e2d7d', marginBottom: 4 }}>
            Фото — {design.name} <span style={{ color: '#64748b', fontWeight: 600 }}>({uploadedCount}/{design.slots.length})</span>
          </h3>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>Завантажте по одному фото в кожну клітинку. Усі {design.slots.length} фото обовʼязкові.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {design.slots.map((s, i) => {
              const st = slots[s.key];
              return (
                <div key={s.key} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 10, background: '#fff' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, minHeight: 30 }}>{i + 1}. {s.label}</div>
                  <input ref={el => { fileInputs.current[s.key] = el; }} type="file" accept="image/*"
                    onChange={e => handleFile(s.key, e.target.files?.[0])} style={{ display: 'none' }} />
                  <div onClick={() => fileInputs.current[s.key]?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f && f.type.startsWith('image/')) handleFile(s.key, f); }}
                    style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', borderRadius: 8, cursor: 'pointer',
                      border: `2px dashed ${st?.path ? '#10b981' : '#cbd5e1'}`, background: '#f8fafc',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {st?.previewUrl
                      ? <img src={st.previewUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: st.uploading ? 0.5 : 1 }} />
                      : <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: 4 }}><Upload size={20} /><span style={{ fontSize: 11 }}>Додати фото</span></div>}
                    {st?.uploading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1e2d7d', fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.4)' }}>Завантаження…</div>}
                    {st?.path && !st.uploading && <div style={{ position: 'absolute', top: 4, left: 4, background: '#10b981', color: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={12} /></div>}
                    {st && <button onClick={e => { e.stopPropagation(); removeSlot(s.key); }} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12} /></button>}
                  </div>
                  {s.caption && (
                    <input type="text" value={captions[s.key] || ''} onChange={e => setCaptions(p => ({ ...p, [s.key]: e.target.value }))}
                      placeholder="Підпис (напр. Сицилія, 2023)" maxLength={40}
                      style={{ ...inputStyle, marginTop: 8, padding: '6px 8px', fontSize: 12 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary + submit */}
          <div style={{ marginTop: 20, padding: 16, borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 14, color: '#64748b' }}>{design.name}{selectedCopy ? ` · ${selectedCopy.label}` : ''}</span>
              <span style={{ fontWeight: 900, fontSize: 22, color: '#1e2d7d' }}>{totalPrice} ₴</span>
            </div>
            {!photosOk && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400e', marginBottom: 12 }}>Завантажено {uploadedCount} з {design.slots.length} фото — додайте решту, щоб продовжити.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ padding: '12px 18px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontWeight: 700, cursor: 'pointer', color: '#374151' }}>← Назад</button>
              <button onClick={handleAddToCart} disabled={!canSubmit}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderRadius: 10, border: 'none',
                  fontWeight: 800, fontSize: 15, background: canSubmit ? '#1e2d7d' : '#94a3b8', color: '#fff', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
                <ShoppingCart size={18} /> Додати до кошика
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
