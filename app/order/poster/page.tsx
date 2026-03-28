'use client';

import { useState, useRef } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { Upload, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart-store';
import { useRouter } from 'next/navigation';

const SIZES = [
    { label: 'A4 (21×30 см)', value: 'A4', price: 0 },
    { label: 'A3 (30×42 см)', value: 'A3', price: 100 },
];

export default function PosterOrderPage() {
    const router = useRouter();
    const { addItem } = useCartStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [size, setSize] = useState('A4');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [comment, setComment] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    const basePrice = 250;
    const sizeModifier = SIZES.find(s => s.value === size)?.price || 0;
    const totalPrice = basePrice + sizeModifier;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };

    const handleSubmit = () => {
        if (!name.trim()) { toast.error("Вкажіть ім'я"); return; }
        if (!phone.trim()) { toast.error('Вкажіть телефон'); return; }

        addItem({
            id: `poster-${Date.now()}`,
            name: 'Постер',
            price: totalPrice,
            qty: 1,
            image: imagePreview || '/placeholder-poster.jpg',
            options: { 'Розмір': size },
            personalization_note: `Ім'я: ${name}\nТелефон: ${phone}\nКоментар: ${comment}`.trim(),
        });

        toast.success('Замовлення додано до кошика!');
        router.push('/cart');
    };

    return (
        <>
            <Navigation />
            <main className="min-h-screen bg-gray-50 pt-28 pb-16">
                <div className="max-w-2xl mx-auto px-4">
                    <h1 className="text-3xl font-bold text-[#1e2d7d] mb-2">Замовити постер</h1>
                    <p className="text-gray-600 mb-8">Завантажте зображення, оберіть розмір та оформіть замовлення</p>

                    <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-6">

                        {/* Size */}
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

                        {/* Image upload */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Зображення</label>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            {imagePreview ? (
                                <div className="relative">
                                    <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg border" />
                                    <button onClick={() => { setImageFile(null); setImagePreview(''); }}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold hover:bg-red-600">
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#1e2d7d] hover:bg-[#f0f3ff] transition-all flex flex-col items-center gap-2 text-gray-500 hover:text-[#1e2d7d]">
                                    <Upload size={32} />
                                    <span className="font-semibold text-sm">Натисніть для завантаження</span>
                                </button>
                            )}
                        </div>

                        {/* Comment */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Побажання щодо дизайну</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Опишіть ваше побажання щодо дизайну постера"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d] resize-none" />
                        </div>

                        <hr className="border-gray-200" />

                        {/* Contact */}
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

                        {/* Price + Submit */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <div>
                                <p className="text-sm text-gray-600">Вартість:</p>
                                <p className="text-2xl font-bold text-[#1e2d7d]">{totalPrice} ₴</p>
                            </div>
                            <button onClick={handleSubmit}
                                className="flex items-center gap-2 px-8 py-4 bg-[#1e2d7d] text-white rounded-lg font-bold text-lg hover:bg-[#263a99] transition-colors">
                                <ShoppingCart size={20} />
                                Замовити
                            </button>
                        </div>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </>
    );
}
