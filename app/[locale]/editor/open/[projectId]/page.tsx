'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { openDesignInConstructor } from '@/lib/editor/open-design';

/**
 * Місток «відкрити макет у конструкторі» за самим лише посиланням.
 *
 * ЧОМУ ВІН ПОТРІБЕН. Конструктор не вміє відкриватися з адреси: макет
 * передається йому через sessionStorage — конфіг, фото з підписаними
 * посиланнями, розкладка по іменах, режим редагування. Кабінет клієнта робив
 * цю передачу сам, натисканням кнопки, а от посилання в листі чи в адмінці
 * зробити її нізвідки. Тому вони вели на /editor/{projectId} — ІНШИЙ,
 * недобудований редактор на fabric.js, який читає pages_data як власний
 * формат, падає на `page.background.type` і показує порожнє полотно. Його
 * кнопка «Скачати PDF» віддавала обкладинку плюс чисті аркуші: цикл по
 * сторінках у ній так і лишився коментарями.
 *
 * Хто сюди ходить: кнопка «Відкрити в редакторі» в картці замовлення (дизайнер
 * правит свою копію макета) і листи-нагадування про незавершений дизайн
 * (клієнт повертається до своєї чернетки). Обидва відкривають те, що належить
 * саме їм, тож підписати файли вистачає їхньої ж сесії.
 *
 * Сторінка нічого не вирішує сама: вся передача — в lib/editor/open-design.ts,
 * спільна з кабінетом.
 */
export default function OpenDesignBridge({ params }: { params: Promise<{ projectId: string }> }) {
    const { projectId } = use(params);
    const router = useRouter();
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const res = await openDesignInConstructor(projectId);
            if (cancelled) return;
            if (!res.ok) { setError(res.error); return; }
            router.replace(res.href);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    return (
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ maxWidth: 460, textAlign: 'center' }}>
                {error ? (
                    <>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>
                            {error}
                        </div>
                        <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6, marginBottom: 16 }}>
                            Найчастіше це означає, що ви увійшли під іншим акаунтом. Відкрийте свої макети в кабінеті
                            і продовжіть роботу звідти.
                        </div>
                        <Link href="/uk/account" style={{ display: 'inline-block', padding: '10px 20px', background: '#263a99', color: '#fff', borderRadius: 10, textDecoration: 'none', fontSize: 13.5, fontWeight: 700 }}>
                            Перейти в кабінет
                        </Link>
                    </>
                ) : (
                    <>
                        <Loader2 size={28} className="animate-spin" style={{ color: '#263a99', marginBottom: 12 }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                            Відкриваємо ваш макет
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                            Готуємо фото до швидкого відкриття. На великому макеті це займає трохи часу.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
