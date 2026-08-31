'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamicImport from 'next/dynamic';
const WallCalendarConstructor = dynamicImport(() => import('@/components/WallCalendarConstructor'), { ssr: false });

function Content() {
    const params = useSearchParams();
    // Розмір приходить або як ?size=, або під власною назвою опції з картки
    // товару (?Розмір=A3) — приймаємо обидва, бо переадресація з каталогу
    // раніше не передавала жодного, і конструктор завжди відкривався на A4.
    const size = params.get('size') || params.get('Розмір') || 'A4';
    // Скільки обведень дат клієнтка оплатила на картці товару (опція-лічильник
    // «Обведення дат», 10 ₴ за дату). Без цього числа конструктор не знав, що
    // обведення взагалі платні, і віддавав їх безкоштовно.
    const marked = parseInt(params.get('Обведення дат') || params.get('obvedennya') || '0', 10);
    return <WallCalendarConstructor initialSize={size} markedDatesPaid={Number.isFinite(marked) ? marked : 0} />;
}

export default function WallCalendarPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Завантаження...</div>}>
            <Content />
        </Suspense>
    );
}
