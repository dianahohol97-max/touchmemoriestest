'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Upload, ShoppingCart, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';

const SIZES = [
    { label: 'A4 (21×30 см)', value: 'A4', price: 0 },
    { label: 'A3 (30×42 см)', value: 'A3', price: 100 },
];

const DOC_TYPES = ['Диплом', 'Грамота', 'Подяка', 'Сертифікат', 'Похвальний лист'];
const THEMES = ['Корпоративна', 'Спортивна', 'Шкільна', 'Святкова', 'Весільна', 'Універсальна'];
const LAMINATIONS = [
    { label: 'Без ламінації', value: 'none', price: 0 },
    { label: 'Глянцева', value: 'glossy', price: 30 },
    { label: 'Матова', value: 'matte', price: 30 },
];

export default function DiplomaOrderPage() {
    const router = useRouter();
    const { addItem } = useCartStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [step, setStep] = useState(1);

    // Step 1 — Parameters
    const [size, setSize] = useState('A4');
    const [docType, setDocType] = useState('Диплом');
    const [theme, setTheme] = useState('Універсальна');
    const [lamination, setLamination] = useState('none');

    // Step 2 — Content
    const [recipient, setRecipient] = useState('');
    const [mainText, setMainText] = useState('');
    const [fromWho, setFromWho] = useState('');
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState('');

    // Step 3 — Contact & Order
    const [quantity, setQuantity] = useState(1);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [comment, setComment] = useState('');

    // Price
    const basePrice = 250;
    const sizePrice = SIZES.find(s => s.value === size)?.price || 0;
    const lamPrice = LAMINATIONS.find(l => l.value === lamination)?.price || 0;
    const unitPrice = basePrice + sizePrice + lamPrice;
    const totalPrice = unitPrice * quantity;

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = () => {
        if (!recipient.trim()) { toast.error("Вкажіть ім'я отримувача"); return; }
        if (!mainText.trim()) { toast.error('Вкажіть основний текст'); return; }
        if (!name.trim()) { toast.error("Вкажіть ваше ім'я"); return; }
        if (!phone.trim()) { toast.error('Вкажіть телефон'); return; }

        addItem({
            id: `diploma-${Date.now()}`,
            name: `${docType} — ${theme}`,
            price: totalPrice,
            qty: 1,
            image: logoPreview || '/placeholder-poster.jpg',
            options: {
                'Розмір': size,
                'Тип': docType,
                'Тематика': theme,
                'Ламінація': LAMINATIONS.find(l => l.value === lamination)?.label || 'Без',
                'Кількість': `${quantity} шт`,
            },
            personalization_note: `Кому: ${recipient}\nТекст: ${mainText}\nВід: ${fromWho || '—'}\nДата: ${docDate}\nІм'я: ${name}\nТелефон: ${phone}\nКоментар: ${comment}`.trim(),
        });

        toast.success('Замовлення додано до кошика!');
        router.push('/cart');
    };

    const stepTitles = ['Параметри', 'Зміст документа', 'Контакти та замовлення'];

    return (
        <>
            <Navigation />
            <main className="min-h-screen bg-gray-50 pt-28 pb-16">
                <div className="max-w-2xl mx-auto px-4">
                    <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">Персоналізований {docType.toLowerCase()}</h1>
                    <p className="text-gray-600 mb-6">Створіть унікальний документ за кілька кроків</p>

                    {/* Step indicator */}
                    <div className="flex gap-2 mb-8">
                        {stepTitles.map((title, i) => (
                            <button key={i} onClick={() => setStep(i + 1)}
                                className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-all ${
                                    step === i + 1 ? 'bg-[#1e2d7d] text-white' :
                                    step > i + 1 ? 'bg-[#d1d5f0] text-[#1e2d7d]' :
                                    'bg-gray-200 text-gray-500'
                                }`}>
                                {i + 1}. {title}
                            </button>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-8">

                        {/* ═══ STEP 1: Parameters ═══ */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Розмір</label>
                                    <div className="flex gap-3">
                                        {SIZES.map(s => (
                                            <button key={s.value} type="button" onClick={() => setSize(s.value)}
                                                className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                                                    size === s.value ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                                }`}>
                                                <span className="block font-bold text-sm">{s.label}</span>
                                                {s.price > 0 && <span className="block text-xs text-gray-500">+{s.price} ₴</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Тип документа</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DOC_TYPES.map(t => (
                                            <button key={t} type="button" onClick={() => setDocType(t)}
                                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                    docType === t ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'
                                                }`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Тематика</label>
                                    <div className="flex flex-wrap gap-2">
                                        {THEMES.map(t => (
                                            <button key={t} type="button" onClick={() => setTheme(t)}
                                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                    theme === t ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300 hover:border-[#1e2d7d]'
                                                }`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Ламінація</label>
                                    <div className="flex gap-3">
                                        {LAMINATIONS.map(l => (
                                            <button key={l.value} type="button" onClick={() => setLamination(l.value)}
                                                className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                                                    lamination === l.value ? 'border-[#1e2d7d] bg-[#f0f3ff] text-[#1e2d7d]' : 'border-gray-200 hover:border-gray-400 text-gray-700'
                                                }`}>
                                                <span className="block font-bold text-sm">{l.label}</span>
                                                {l.price > 0 && <span className="block text-xs text-gray-500">+{l.price} ₴</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <button onClick={() => setStep(2)}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#1e2d7d] text-white rounded-lg font-bold text-lg hover:bg-[#263a99] transition-colors">
                                    Далі <ChevronRight size={20} />
                                </button>
                            </div>
                        )}

                        {/* ═══ STEP 2: Content ═══ */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Кому (ім'я отримувача) <span className="text-red-500">*</span></label>
                                    <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} placeholder="Прізвище Ім'я По-батькові"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Основний текст <span className="text-red-500">*</span></label>
                                    <textarea value={mainText} onChange={e => setMainText(e.target.value)} rows={3} placeholder="За що нагороджується (наприклад: за високі досягнення в навчанні)"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Від кого</label>
                                    <input type="text" value={fromWho} onChange={e => setFromWho(e.target.value)} placeholder="Організація, директор, тренер..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Дата</label>
                                    <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Логотип / зображення</label>
                                    <input type="file" ref={fileInputRef} onChange={handleLogoChange} accept="image/*" className="hidden" />
                                    {logoPreview ? (
                                        <div className="relative inline-block">
                                            <img src={logoPreview} alt="Logo" className="h-20 rounded-lg border" />
                                            <button onClick={() => { setLogoFile(null); setLogoPreview(''); }}
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">×</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => fileInputRef.current?.click()}
                                            className="px-6 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#1e2d7d] text-gray-500 hover:text-[#1e2d7d] text-sm font-semibold transition-all">
                                            <Upload size={16} className="inline mr-2" /> Завантажити
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(1)}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors">
                                        <ChevronLeft size={20} /> Назад
                                    </button>
                                    <button onClick={() => { if (!recipient.trim() || !mainText.trim()) { toast.error('Заповніть обов\'язкові поля'); return; } setStep(3); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#1e2d7d] text-white rounded-lg font-bold hover:bg-[#263a99] transition-colors">
                                        Далі <ChevronRight size={20} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* ═══ STEP 3: Contact & Order ═══ */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Кількість</label>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                            className="w-10 h-10 border-2 border-[#1e2d7d] rounded-lg font-bold text-[#1e2d7d] hover:bg-[#f0f3ff]">−</button>
                                        <span className="text-xl font-bold text-[#1e2d7d] min-w-[40px] text-center">{quantity}</span>
                                        <button onClick={() => setQuantity(q => q + 1)}
                                            className="w-10 h-10 border-2 border-[#1e2d7d] rounded-lg font-bold text-[#1e2d7d] hover:bg-[#f0f3ff]">+</button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ім'я <span className="text-red-500">*</span></label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ваше ім'я"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Телефон <span className="text-red-500">*</span></label>
                                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..."
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Коментар</label>
                                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Додаткові побажання..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none" />
                                </div>

                                {/* Price summary */}
                                <div className="p-4 bg-[#f0f3ff] rounded-lg border border-[#1e2d7d]/10">
                                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Базова ціна:</span><span>{basePrice} ₴</span>
                                    </div>
                                    {sizePrice > 0 && <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Розмір {size}:</span><span>+{sizePrice} ₴</span>
                                    </div>}
                                    {lamPrice > 0 && <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>Ламінація:</span><span>+{lamPrice} ₴</span>
                                    </div>}
                                    {quantity > 1 && <div className="flex justify-between text-sm text-gray-600 mb-1">
                                        <span>× {quantity} шт:</span><span>{unitPrice} × {quantity}</span>
                                    </div>}
                                    <div className="flex justify-between font-bold text-[#1e2d7d] text-lg pt-2 border-t border-[#1e2d7d]/10 mt-2">
                                        <span>Всього:</span><span>{totalPrice} ₴</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => setStep(2)}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-colors">
                                        <ChevronLeft size={20} /> Назад
                                    </button>
                                    <button onClick={handleSubmit}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#1e2d7d] text-white rounded-lg font-bold text-lg hover:bg-[#263a99] transition-colors">
                                        <ShoppingCart size={20} /> Замовити • {totalPrice} ₴
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </>
    );
}
