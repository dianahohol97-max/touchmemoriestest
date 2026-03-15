'use client';
import { useState, useEffect } from 'react';
import styles from './checkout.module.css';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { useCartStore } from '@/store/cart-store';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronRight,
    CreditCard,
    Truck,
    User,
    CheckCircle2,
    Loader2,
    ChevronLeft,
    ShoppingBag,
    ShieldCheck
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';

type Step = 'info' | 'shipping' | 'payment' | 'complete';

export default function CheckoutPage() {
    const { items, getTotal, clearCart } = useCartStore();
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState<Step>('info');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const total = getTotal();

    const supabase = createClient();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        city: '',
        branch: '',
        paymentMethod: 'card'
    });

    useEffect(() => {
        if (items.length === 0 && currentStep !== 'complete') {
            router.push('/catalog');
        }
    }, [items, currentStep, router]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const nextStep = () => {
        if (currentStep === 'info') {
            if (!formData.name || !formData.phone || !formData.email) {
                toast.error('Будь ласка, заповніть усі поля');
                return;
            }
            setCurrentStep('shipping');
        } else if (currentStep === 'shipping') {
            if (!formData.city || !formData.branch) {
                toast.error('Будь ласка, виберіть місто та відділення нп');
                return;
            }
            setCurrentStep('payment');
        }
    };

    const prevStep = () => {
        if (currentStep === 'shipping') setCurrentStep('info');
        if (currentStep === 'payment') setCurrentStep('shipping');
    };

    const handleSubmitOrder = async () => {
        setIsSubmitting(true);
        try {
            // 1. Create order number
            const orderNumber = `TM-${Math.floor(100000 + Math.random() * 900000)}`;

            // 2. Prepare order data
            const orderData = {
                order_number: orderNumber,
                customer_name: formData.name,
                customer_phone: formData.phone,
                customer_email: formData.email,
                items: items,
                total: total,
                delivery_method: 'Нова Пошта',
                delivery_address: {
                    city: formData.city,
                    branch: formData.branch
                },
                payment_status: 'pending',
                order_status: 'new',
                created_at: new Date().toISOString()
            };

            // 3. Save to Supabase
            const { error } = await supabase
                .from('orders')
                .insert([orderData]);

            if (error) throw error;

            toast.success('Замовлення успішно зміщено!');
            setCurrentStep('complete');
            clearCart();

        } catch (error: any) {
            console.error('Checkout error:', error);
            toast.error('Помилка при оформленні: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (currentStep === 'complete') {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <Navigation />
                <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '140px 20px' }}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ textAlign: 'center', maxWidth: '500px' }}
                    >
                        <div style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            backgroundColor: '#dcfce7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 24px'
                        }}>
                            <CheckCircle2 size={40} color="#16a34a" />
                        </div>
                        <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '16px' }}>Дякуємо за замовлення!</h1>
                        <p style={{ color: '#666', fontSize: '18px', lineHeight: 1.6, marginBottom: '32px' }}>
                            Ми отримали вашу заявку і скоро зв'яжемося з вами для підтвердження.
                            Ваші спогади у надійних руках!
                        </p>
                        <button
                            onClick={() => router.push('/catalog')}
                            style={{
                                padding: '16px 32px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 700,
                                cursor: 'pointer'
                            }}
                        >
                            Повернутися до каталогу
                        </button>
                    </motion.div>
                </main>
                <Footer categories={[]} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
            <Navigation />

            <main style={{ flex: 1, padding: '140px 20px 80px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '40px' }} className={styles.checkoutGrid}>

                    {/* Left: Form */}
                    <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        {/* Stepper Header */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '40px' }}>
                            <StepIndicator label="Контакти" active={currentStep === 'info'} completed={currentStep !== 'info'} />
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#eee', alignSelf: 'center' }} />
                            <StepIndicator label="Доставка" active={currentStep === 'shipping'} completed={currentStep === 'payment'} />
                            <div style={{ flex: 1, height: '1px', backgroundColor: '#eee', alignSelf: 'center' }} />
                            <StepIndicator label="Оплата" active={currentStep === 'payment'} completed={false} />
                        </div>

                        <AnimatePresence mode="wait">
                            {currentStep === 'info' && (
                                <motion.div
                                    key="info"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Контактні дані</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <InputField
                                            label="Ваше ім'я"
                                            name="name"
                                            value={formData.name}
                                            onChange={handleInputChange}
                                            placeholder="Прізвище та ім'я"
                                            icon={<User size={18} />}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                            <InputField
                                                label="Телефон"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleInputChange}
                                                placeholder="+380"
                                            />
                                            <InputField
                                                label="Email"
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="example@mail.com"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: '40px' }}>
                                        <NextButton onClick={nextStep} />
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 'shipping' && (
                                <motion.div
                                    key="shipping"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Доставка (Нова Пошта)</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                        <InputField
                                            label="Місто"
                                            name="city"
                                            value={formData.city}
                                            onChange={handleInputChange}
                                            placeholder="Введіть ваше місто"
                                            icon={<Truck size={18} />}
                                        />
                                        <InputField
                                            label="Відділення / Поштомат"
                                            name="branch"
                                            value={formData.branch}
                                            onChange={handleInputChange}
                                            placeholder="Номер відділення або адреса почтомату"
                                        />
                                    </div>
                                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                                        <BackButton onClick={prevStep} />
                                        <NextButton onClick={nextStep} />
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 'payment' && (
                                <motion.div
                                    key="payment"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                >
                                    <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px' }}>Спосіб оплати</h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        <PaymentOption
                                            id="card"
                                            label="Оплата карткою (MonoPay)"
                                            active={formData.paymentMethod === 'card'}
                                            onClick={() => setFormData(p => ({ ...p, paymentMethod: 'card' }))}
                                            icon={<CreditCard size={24} />}
                                        />
                                        <PaymentOption
                                            id="cash"
                                            label="Оплата при отриманні (Накладений платіж)"
                                            active={formData.paymentMethod === 'cash'}
                                            onClick={() => setFormData(p => ({ ...p, paymentMethod: 'cash' }))}
                                            icon={<Truck size={24} />}
                                        />
                                    </div>
                                    <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between' }}>
                                        <BackButton onClick={prevStep} />
                                        <button
                                            onClick={handleSubmitOrder}
                                            disabled={isSubmitting}
                                            style={{
                                                padding: '16px 32px',
                                                backgroundColor: 'var(--primary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                fontSize: '16px',
                                                fontWeight: 800,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                boxShadow: '0 10px 20px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {isSubmitting ? (
                                                <Loader2 className="animate-spin" size={20} />
                                            ) : (
                                                <>Підтвердити замовлення <ArrowRight size={20} /></>
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Right: Summary */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                                <ShoppingBag size={20} color="var(--primary)" />
                                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>Ваше замовлення</h3>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px', maxHeight: '400px', overflowY: 'auto' }}>
                                {items.map(item => (
                                    <div key={item.id} style={{ display: 'flex', gap: '12px' }}>
                                        <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                            <Image src={item.image || ''} alt={item.name} fill style={{ objectFit: 'cover' }} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2, marginBottom: '4px' }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>
                                                {item.qty} шт. × {item.price} ₴
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{item.price * item.qty} ₴</div>
                                    </div>
                                ))}
                            </div>

                            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
                                    <span>Вартість товарів:</span>
                                    <span>{total} ₴</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px', color: '#666' }}>
                                    <span>Доставка:</span>
                                    <span>за тарифами перевізника</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>
                                    <span>Разом:</span>
                                    <span>{total} ₴</span>
                                </div>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#f0f9ff', borderRadius: '24px', padding: '24px', border: '1px solid #e0f2fe', display: 'flex', gap: '12px' }}>
                            <ShieldCheck size={24} color="#0369a1" />
                            <p style={{ fontSize: '13px', color: '#0369a1', lineHeight: 1.5, margin: 0 }}>
                                <strong>Безпечна оплата.</strong> Ваші дані захищені. Ми використовуємо сучасні стандарти безпеки.
                            </p>
                        </div>
                    </div>
                </div>
            </main>

            <Footer categories={[]} />

        </div>
    );
}

// Helper Components
function StepIndicator({ label, active, completed }: { label: string, active: boolean, completed: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: completed ? '#dcfce7' : (active ? 'var(--primary)' : '#f3f4f6'),
                color: completed ? '#16a34a' : (active ? 'white' : '#9ca3af'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 700
            }}>
                {completed ? <CheckCircle2 size={18} /> : (active ? '•' : '')}
            </div>
            <span style={{ fontSize: '11px', fontWeight: active || completed ? 700 : 500, color: active || completed ? '#263A99' : '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </span>
        </div>
    );
}

function InputField({ label, icon, ...props }: any) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                {icon && <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>{icon}</div>}
                <input
                    {...props}
                    style={{
                        width: '100%',
                        padding: `14px 16px ${icon ? '14px 44px' : '14px 16px'}`,
                        paddingLeft: icon ? '44px' : '16px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '15px',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                />
            </div>
        </div>
    );
}

function NextButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '16px 32px',
                backgroundColor: 'var(--primary)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
                transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
        >
            Далі <ChevronRight size={20} />
        </button>
    );
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                padding: '16px 24px',
                backgroundColor: 'transparent',
                color: '#64748b',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}
        >
            <ChevronLeft size={20} /> Назад
        </button>
    );
}

function ArrowRight({ size }: { size: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
        </svg>
    )
}

function PaymentOption({ id, label, active, onClick, icon }: any) {
    return (
        <div
            onClick={onClick}
            style={{
                padding: '20px',
                borderRadius: '16px',
                border: active ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                backgroundColor: active ? '#f8fafc' : 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s'
            }}
        >
            <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: active ? 'white' : '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: active ? 'var(--primary)' : '#64748b',
                boxShadow: active ? '0 4px 10px rgba(0,0,0,0.05)' : 'none'
            }}>
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#263A99' }}>{label}</div>
            </div>
            <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: active ? '6px solid var(--primary)' : '2px solid #e2e8f0',
                transition: 'all 0.2s'
            }} />
        </div>
    );
}
