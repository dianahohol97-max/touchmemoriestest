'use client';

import { Suspense, Component, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import BookConstructorConfig from '@/components/BookConstructorConfig';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    render() {
        if (// @ts-ignore
        this.state.error) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ color: 'red', marginBottom: '1rem' }}>Помилка завантаження конструктора</h2>
                    <pre style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto', background: '#f5f5f5', padding: '1rem', borderRadius: 8, overflow: 'auto', fontSize: 12 }}>
                        {// @ts-ignore
        this.state.error.message}
                        {'\n\n'}
                        {// @ts-ignore
        this.state.error.stack}
                    </pre>
                    <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        Перезавантажити
                    </button>
                </div>
            );
        }
        return // @ts-ignore
        this.props.children;
    }
}

function BookOrderContent() {
    const searchParams = useSearchParams();
    const productSlug = searchParams.get('product') || 'photobook-velour';

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />
            <main className="py-24">
                <ErrorBoundary>
                    <BookConstructorConfig productSlug={productSlug} />
                </ErrorBoundary>
            </main>
            <Footer categories={[]} />
        </div>
    );
}

export default function BookOrderPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <BookOrderContent />
        </Suspense>
    );
}
