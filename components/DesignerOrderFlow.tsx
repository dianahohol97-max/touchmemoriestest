'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Upload, Trash2, ChevronLeft, ChevronRight, CheckCircle, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { createBrowserClient } from '@supabase/auth-helpers-nextjs';

//  Types 

interface UploadedPhoto {
    id: string;
    file: File;
    preview: string;
    uploading: boolean;
    uploaded: boolean;
    storagePath?: string;
}

//  Step Labels 

const STEPS = [
    'Завантаження фото',
    'Коментар',
    'Контакти',
    'Доставка',
    'Підтвердження',
];

//  Main Component 

export default function DesignerOrderFlow() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const supabase = useMemo(() => createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ), []);

    // URL params
    const productSlug = searchParams.get('product') || '';
    const size = searchParams.get('size') || '';
    const pages = searchParams.get('pages') || '';
    const cover = searchParams.get('cover') || '';
    const tracing = searchParams.get('tracing') || '';
    const color = searchParams.get('color') || '';
    const decoration = searchParams.get('decoration') || '';
    const decorationVariant = searchParams.get('decoration_variant') || '';

    const pageCount = parseInt(pages) || 20;
    const minPhotos = Math.ceil(pageCount * 0.8);
    const maxPhotos = Math.ceil(pageCount * 1.2);

    // State
    const [step, setStep] = useState(1);
    const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

    // Step 2
    const [orderComment, setOrderComment] = useState('');
    const [coverComment, setCoverComment] = useState('');

    // Step 3
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [telegram, setTelegram] = useState('');
    const [email, setEmail] = useState('');
    const [contactMethod, setContactMethod] = useState<'telegram' | 'email' | 'any'>('any');

    // Step 4
    const [deliveryMethod, setDeliveryMethod] = useState<'nova_poshta' | 'pickup'>('nova_poshta');
    const [city, setCity] = useState('');
    const [branch, setBranch] = useState('');

    // Step 5
    const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online');
    const [showAddMorePrompt, setShowAddMorePrompt] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [orderComplete, setOrderComplete] = useState(false);

    //  Photo Upload 

    const handleFiles = useCallback((files: FileList | File[]) => {
        const accepted = ['image/jpeg', 'image/png', 'image/heic', 'image/heif'];
        const newPhotos: UploadedPhoto[] = [];

        Array.from(files).forEach(file => {
            if (!accepted.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|heic|raw)$/i)) {
                toast.error(`${file.name}: непідтримуваний формат`);
                return;
            }
            if (file.size > 50 * 1024 * 1024) {
                toast.error(`${file.name}: файл занадто великий (макс 50MB)`);
                return;
            }
            newPhotos.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                file,
                preview: URL.createObjectURL(file),
                uploading: false,
                uploaded: false,
            });
        });

        setPhotos(prev => [...prev, ...newPhotos]);
    }, []);

    const removePhoto = (id: string) => {
        setPhotos(prev => {
            const photo = prev.find(p => p.id === id);
            if (photo) URL.revokeObjectURL(photo.preview);
            return prev.filter(p => p.id !== id);
        });
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    };

    // Upload all photos to Supabase Storage
    const uploadPhotosToStorage = async (): Promise<string[]> => {
        const paths: string[] = [];
        const orderId = `designer-${Date.now()}`;

        for (const photo of photos) {
            if (photo.uploaded && photo.storagePath) {
                paths.push(photo.storagePath);
                continue;
            }

            const ext = photo.file.name.split('.').pop() || 'jpg';
            const path = `order-files/${orderId}/${photo.id}.${ext}`;

            const { error } = await supabase.storage
                .from('order-files')
                .upload(path, photo.file, { upsert: true });

            if (error) {
                console.error('Upload error:', error);
                toast.error(`Помилка завантаження ${photo.file.name}`);
            } else {
                paths.push(path);
                setPhotos(prev => prev.map(p =>
                    p.id === photo.id ? { ...p, uploaded: true, storagePath: path } : p
                ));
            }
        }

        return paths;
    };

    //  Submit Order 

    const submitOrder = async () => {
        setSubmitting(true);

        try {
            // Upload photos
            const filePaths = await uploadPhotosToStorage();

            // Build product name
            const productName = productSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            // Create order
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
                        size, pages, cover, tracing, color, decoration, decoration_variant: decorationVariant,
                        quantity: 1,
                    }],
                    notes: [orderComment, coverComment].filter(Boolean).join('\n---\n'),
                    delivery_method: deliveryMethod,
                    delivery_address: deliveryMethod === 'nova_poshta' ? { city, branch } : { pickup: 'Тернопіль' },
                    payment_method: paymentMethod,
                    order_status: 'new',
                    payment_status: 'pending',
                    contact_method: contactMethod,
                    total_price: 0, // Will be calculated by admin after design
                })
                .select('id')
                .single();

            if (orderError) throw orderError;

            // Link files to order
            if (order && filePaths.length > 0) {
                await supabase.from('order_files').insert(
                    filePaths.map(path => ({
                        order_id: order.id,
                        file_path: path,
                        file_type: 'photo',
                    }))
                );
            }

            setOrderComplete(true);
            toast.success('Замовлення прийнято!');
        } catch (err: any) {
            console.error('Order error:', err);
            toast.error('Помилка при оформленні замовлення. Спробуйте ще раз.');
        } finally {
            setSubmitting(false);
        }
    };

    //  Validation 

    const canGoNext = (): boolean => {
        switch (step) {
            case 1: return photos.length > 0;
            case 2: return true; // Comments are optional
            case 3:
                if (!firstName.trim() || !lastName.trim() || !phone.trim()) return false;
                if (contactMethod === 'telegram' && !telegram.trim()) return false;
                if (contactMethod === 'email' && !email.trim()) return false;
                return true;
            case 4:
                if (deliveryMethod === 'nova_poshta' && (!city.trim() || !branch.trim())) return false;
                return true;
            case 5: return true;
            default: return false;
        }
    };

    //  Success Screen 

    if (orderComplete) {
        return (
            <>
                <Navigation />
                <main className="min-h-screen bg-gray-50 pt-28 pb-16 flex items-center justify-center">
                    <div className="max-w-md text-center px-4">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle size={48} className="text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-[#1e2d7d] mb-3">Замовлення прийнято!</h1>
                        <p className="text-gray-600 mb-6">Ми зв'яжемось з вами найближчим часом для узгодження дизайну.</p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={() => router.push('/catalog')}
                                className="px-6 py-3 border-2 border-[#1e2d7d] text-[#1e2d7d] rounded-lg font-semibold hover:bg-[#f0f3ff] transition-colors">
                                До каталогу
                            </button>
                            <button onClick={() => router.push('/')}
                                className="px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] transition-colors">
                                На головну
                            </button>
                        </div>
                    </div>
                </main>
                <Footer categories={[]} />
            </>
        );
    }

    //  Render 

    return (
        <>
            <Navigation />
            <main className="min-h-screen bg-gray-50 pt-28 pb-16">
                <div className="max-w-3xl mx-auto px-4">

                    {/* Header */}
                    <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">Оформити з дизайнером</h1>
                    <p className="text-gray-600 mb-6">Завантажте фото — наш дизайнер створить макет для вас</p>

                    {/* Step Progress */}
                    <div className="flex gap-1 mb-8">
                        {STEPS.map((label, i) => (
                            <div key={i} className="flex-1">
                                <div className={`h-1.5 rounded-full transition-colors ${
                                    i + 1 <= step ? 'bg-[#1e2d7d]' : 'bg-gray-200'
                                }`} />
                                <p className={`text-xs mt-1 font-medium ${
                                    i + 1 === step ? 'text-[#1e2d7d]' : 'text-gray-400'
                                }`}>{i + 1}. {label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 p-8">

                        {/*  STEP 1: Photo Upload  */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-[#1e2d7d] mb-2">Завантажте ваші фотографії</h2>
                                    <p className="text-sm text-gray-600">Рекомендуємо {minPhotos}–{maxPhotos} фото для {pages} сторінок. Формати: JPG, PNG, HEIC.</p>
                                </div>

                                {/* Drop zone */}
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={e => e.preventDefault()}
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-[#1e2d7d] hover:bg-[#f0f3ff] transition-all"
                                >
                                    <Upload size={40} className="mx-auto mb-3 text-gray-400" />
                                    <p className="font-semibold text-gray-700">Перетягніть фото сюди або натисніть для вибору</p>
                                    <p className="text-sm text-gray-500 mt-1">JPG, PNG, HEIC • макс 50MB на файл</p>
                                </div>
                                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.heic,.raw"
                                    onChange={e => e.target.files && handleFiles(e.target.files)} className="hidden" />

                                {/* Thumbnails */}
                                {photos.length > 0 && (
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700 mb-3">{photos.length} фото завантажено</p>
                                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                                            {photos.map((p, i) => (
                                                <div key={p.id} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                                                    <img src={p.preview} alt="" className="w-full h-full object-cover" />
                                                    <button onClick={(e) => { e.stopPropagation(); removePhoto(p.id); }}
                                                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Trash2 size={12} />
                                                    </button>
                                                    <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  STEP 2: Comments  */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold text-[#1e2d7d]">Побажання до замовлення</h2>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Коментар до замовлення</label>
                                    <textarea value={orderComment} onChange={e => setOrderComment(e.target.value)} rows={4}
                                        placeholder="Побажання щодо розташування фото, тексту, дати тощо"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Побажання щодо обкладинки</label>
                                    <textarea value={coverComment} onChange={e => setCoverComment(e.target.value)} rows={3}
                                        placeholder="Наприклад: мінімалістичний стиль, без написів, пастельні кольори"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none" />
                                </div>
                            </div>
                        )}

                        {/*  STEP 3: Contact Info  */}
                        {step === 3 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold text-[#1e2d7d]">Контактні дані</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Ім'я <span className="text-red-500">*</span></label>
                                        <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Ім'я"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Прізвище <span className="text-red-500">*</span></label>
                                        <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Прізвище"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Телефон <span className="text-red-500">*</span></label>
                                    <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+380..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Як з вами зв'язатись?</label>
                                    <div className="flex gap-3">
                                        {([['telegram', 'Telegram'], ['email', 'Email'], ['any', 'Будь-який спосіб']] as const).map(([val, label]) => (
                                            <button key={val} type="button" onClick={() => setContactMethod(val)}
                                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                    contactMethod === val ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]' : 'bg-white text-gray-700 border-gray-300'
                                                }`}>{label}</button>
                                        ))}
                                    </div>
                                </div>
                                {(contactMethod === 'telegram' || contactMethod === 'any') && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Telegram {contactMethod === 'telegram' && <span className="text-red-500">*</span>}</label>
                                        <input type="text" value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="@username"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                )}
                                {(contactMethod === 'email' || contactMethod === 'any') && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email {contactMethod === 'email' && <span className="text-red-500">*</span>}</label>
                                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  STEP 4: Delivery  */}
                        {step === 4 && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold text-[#1e2d7d]">Доставка</h2>
                                <div className="space-y-3">
                                    {([['nova_poshta', 'Нова Пошта', 'За тарифами перевізника'], ['pickup', 'Самовивіз (Тернопіль)', 'Безкоштовно']] as const).map(([val, label, sub]) => (
                                        <button key={val} type="button" onClick={() => setDeliveryMethod(val)}
                                            className={`w-full flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                                                deliveryMethod === val ? 'border-[#1e2d7d] bg-[#f0f3ff]' : 'border-gray-200 hover:border-gray-400'
                                            }`}>
                                            <div className="text-left">
                                                <span className="font-semibold text-gray-800">{label}</span>
                                                <span className="block text-sm text-gray-500">{sub}</span>
                                            </div>
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                                deliveryMethod === val ? 'border-[#1e2d7d]' : 'border-gray-300'
                                            }`}>
                                                {deliveryMethod === val && <div className="w-3 h-3 rounded-full bg-[#1e2d7d]" />}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                {deliveryMethod === 'nova_poshta' && (
                                    <div className="space-y-4 pt-2">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Місто <span className="text-red-500">*</span></label>
                                            <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Наприклад: Київ"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Відділення / поштомат <span className="text-red-500">*</span></label>
                                            <input type="text" value={branch} onChange={e => setBranch(e.target.value)} placeholder="Номер відділення або поштомату"
                                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/*  STEP 5: Confirmation  */}
                        {step === 5 && !showAddMorePrompt && (
                            <div className="space-y-6">
                                <h2 className="text-xl font-bold text-[#1e2d7d]">Підтвердження замовлення</h2>

                                {/* Summary */}
                                <div className="p-4 bg-gray-50 rounded-lg border space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-600">Продукт:</span><span className="font-semibold">{productSlug.replace(/-/g, ' ')}</span></div>
                                    {size && <div className="flex justify-between"><span className="text-gray-600">Розмір:</span><span>{size}</span></div>}
                                    {pages && <div className="flex justify-between"><span className="text-gray-600">Сторінок:</span><span>{pages}</span></div>}
                                    {cover && <div className="flex justify-between"><span className="text-gray-600">Обкладинка:</span><span>{cover}</span></div>}
                                    {color && <div className="flex justify-between"><span className="text-gray-600">Колір:</span><span>{color}</span></div>}
                                    {decoration && decoration !== 'none' && <div className="flex justify-between"><span className="text-gray-600">Оздоблення:</span><span>{decoration}</span></div>}
                                    {tracing === 'with' && <div className="flex justify-between"><span className="text-gray-600">Калька:</span><span>Так</span></div>}
                                    <div className="flex justify-between"><span className="text-gray-600">Фото:</span><span>{photos.length} шт</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Отримувач:</span><span>{firstName} {lastName}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Телефон:</span><span>{phone}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-600">Доставка:</span><span>{deliveryMethod === 'pickup' ? 'Самовивіз' : `НП: ${city}, ${branch}`}</span></div>
                                </div>

                                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-800">
                                    Точну вартість буде розраховано дизайнером після створення макету. Ми зв'яжемось з вами для підтвердження.
                                </div>

                                {/* Payment */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-3">Спосіб оплати</label>
                                    <div className="space-y-2">
                                        {([['online', 'Онлайн (Monobank)'], ['cod', 'При отриманні (накладений платіж)']] as const).map(([val, label]) => (
                                            <button key={val} type="button" onClick={() => setPaymentMethod(val)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                                                    paymentMethod === val ? 'border-[#1e2d7d] bg-[#f0f3ff]' : 'border-gray-200'
                                                }`}>
                                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                    paymentMethod === val ? 'border-[#1e2d7d]' : 'border-gray-300'
                                                }`}>
                                                    {paymentMethod === val && <div className="w-2 h-2 rounded-full bg-[#1e2d7d]" />}
                                                </div>
                                                <span className="text-sm font-medium">{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Add more items prompt */}
                        {showAddMorePrompt && (
                            <div className="text-center py-8 space-y-4">
                                <h3 className="text-lg font-bold text-[#1e2d7d]">Бажаєте додати ще товари до замовлення?</h3>
                                <div className="flex gap-3 justify-center">
                                    <button onClick={() => router.push('/catalog')}
                                        className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50">
                                        <ChevronLeft size={16} className="inline mr-1" /> Повернутись до каталогу
                                    </button>
                                    <button onClick={() => { setShowAddMorePrompt(false); submitOrder(); }}
                                        disabled={submitting}
                                        className="px-6 py-3 bg-[#1e2d7d] text-white rounded-lg font-semibold hover:bg-[#263a99] flex items-center gap-2">
                                        {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                                        Оформити замовлення
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Navigation buttons */}
                        {!showAddMorePrompt && !orderComplete && (
                            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
                                {step > 1 && (
                                    <button onClick={() => setStep(s => s - 1)}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors">
                                        <ChevronLeft size={18} /> Назад
                                    </button>
                                )}
                                {step < 5 ? (
                                    <button onClick={() => canGoNext() && setStep(s => s + 1)} disabled={!canGoNext()}
                                        className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-lg font-semibold transition-colors ${
                                            canGoNext() ? 'bg-[#1e2d7d] text-white hover:bg-[#263a99]' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}>
                                        Далі <ChevronRight size={18} />
                                    </button>
                                ) : (
                                    <button onClick={() => setShowAddMorePrompt(true)} disabled={submitting}
                                        className="flex-1 flex items-center justify-center gap-2 py-4 bg-[#1e2d7d] text-white rounded-lg font-bold text-lg hover:bg-[#263a99] transition-colors">
                                        {submitting ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                        Оформити замовлення
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </>
    );
}
