'use client';
import React from 'react';

/**
 * Готовий файл обкладинки (printedBgImage) на передній половині аркуша.
 *
 * ОДИН компонент для всіх трьох місць, де ця картинка малюється — конструктор
 * (CoverEditor), превʼю/друк (BookPreviewModal) і мініатюра навігації в
 * редакторі, — щоб клієнт, адмін і друкарня бачили той самий кадр. Раніше
 * кожне місце тримало власний <img objectFit:cover inset:0>, і коли спосіб
 * укладання міняється (а він щойно змінився), три копії — це три шанси
 * розійтись.
 *
 * Режими:
 *   inset=null — по-старому: картинка на всю площину (фотокниги, розміри без
 *     специфікації загину).
 *   inset заданий — чітка картинка сідає ДО лінії загину (відсотки з
 *     lib/print/trim-guides.coverArtworkInset), а поля загину добудовує
 *     розмита копія тієї ж картинки: для однотонного фону це рівно той самий
 *     колір, для строкатого — м'яке продовження без швів. Внутрішній край
 *     (до корінця) не відступає — там згин, а не загин.
 */
export function PrintedCoverArtwork({
    src,
    inset,
    side = 'front',
}: {
    src: string;
    inset: { topPct: number; bottomPct: number; outerPct: number } | null;
    side?: 'front' | 'back';
}) {
    if (!inset) {
        return (
            <img src={src} alt="" draggable={false}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
        );
    }
    const outerEdge = side === 'front' ? 'right' : 'left';
    const innerEdge = side === 'front' ? 'left' : 'right';
    return (
        <>
            {/* Поля загину: та сама картинка, розмита і трохи збільшена, щоб
                blur не тягнув прозорі краї. scale тримає її в межах контейнера. */}
            <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <img src={src} alt="" draggable={false}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(24px)', transform: 'scale(1.2)' }} />
            </div>
            {/* Чітка картинка — до лінії загину. */}
            <div style={{
                position: 'absolute',
                top: `${inset.topPct}%`,
                bottom: `${inset.bottomPct}%`,
                [outerEdge]: `${inset.outerPct}%`,
                [innerEdge]: 0,
                overflow: 'hidden',
                pointerEvents: 'none',
            } as React.CSSProperties}>
                <img src={src} alt="" draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
        </>
    );
}
