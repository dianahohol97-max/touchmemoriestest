'use client';

export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function OrderSuccessContent() {
    const searchParams = useSearchParams();
    const orderNumber = searchParams.get('order');

    return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: '500px', textAlign: 'center', padding: '60px 40px' }}>
                <div style={{ fontSize: '5rem', marginBottom: '20px' }}>🎉</div>
                <h1 style={{ fontSize: '2.5rem', marginBottom: '10px' }}>Дякуємо!</h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '30px' }}>
                    Ваше замовлення <strong>#{orderNumber}</strong> успішно оформлене та оплачене.
                </p>
                <p style={{ marginBottom: '40px' }}>
                    Ми вже почали підготовку вашої фотокниги. Чекайте на оновлення статусу у Viber або SMS.
                </p>
                <a href="/catalog" className="btn-shop">Повернутися до магазину</a>
            </div>
        </div>
    );
}

export default function OrderSuccessPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Завантаження...</div>}>
            <OrderSuccessContent />
        </Suspense>
    );
}
