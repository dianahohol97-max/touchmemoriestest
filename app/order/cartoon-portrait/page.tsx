import { Suspense } from 'react';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import dynamic from 'next/dynamic';
const CartoonPortraitConstructor = dynamic(() => import('@/components/CartoonPortraitConstructor'), { ssr: false });

export default function CartoonPortraitPage() {
    return (
        <>
            <Navigation />
            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600">Завантаження...</p>
                    </div>
                </div>
            }>
                <CartoonPortraitConstructor />
            </Suspense>
            <Footer categories={[]} />
        </>
    );
}
