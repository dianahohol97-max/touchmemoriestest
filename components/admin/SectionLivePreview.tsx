'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n/context';
import { ConstructorSelectionClient } from '@/components/ui/ConstructorSelectionClient';
import { CustomBookPromoClient } from '@/components/ui/CustomBookPromoClient';
import { PhotoPrintPromoClient } from '@/components/ui/PhotoPrintPromoClient';
import { PhotoboothSectionClient } from '@/components/ui/PhotoboothSectionClient';

// Live, on-page preview of a homepage section, driven by the current (unsaved)
// editing state so Diana sees exactly what she is editing.
//
// Content-only sections are rendered with the SAME components the homepage
// uses, so the preview is pixel-accurate. Data-driven sections (popular
// products, gift ideas) need product data the admin doesn't load, so they get
// a faithful generic card instead of an empty real grid.
//
// The whole preview is pointer-events:none so links/videos/buttons inside the
// real components can't be clicked away from the admin form.

function GenericPreview({ section }: { section: any }) {
    const heading = section.heading || '—';
    return (
        <div className="px-8 py-12 bg-white">
            <div className="max-w-3xl mx-auto text-center">
                <div className="text-xs font-semibold tracking-widest uppercase text-[#1e2d7d]/60 mb-3">
                    {section.section_name}
                </div>
                <h2 className="text-3xl font-black text-[#1e2d7d] mb-3 tracking-tight">{heading}</h2>
                {section.subheading && (
                    <p className="text-lg text-stone-600 mb-2">{section.subheading}</p>
                )}
                {section.body_text && (
                    <p className="text-stone-500 leading-relaxed mb-6 whitespace-pre-line">{section.body_text}</p>
                )}
                {section.image_url && (
                    <img src={section.image_url} alt="" className="mx-auto rounded-xl shadow-lg max-h-72 object-cover mb-6" />
                )}
                {section.cta_text && (
                    <span className="inline-block px-6 py-3 rounded-full bg-[#1e2d7d] text-white font-semibold">
                        {section.cta_text}
                    </span>
                )}
                <p className="mt-6 text-xs text-stone-400">
                    Спрощене прев'ю — на головній ця секція підтягує товари/колекції з бази.
                </p>
            </div>
        </div>
    );
}

const EXACT: Record<string, (s: any) => React.ReactNode> = {
    constructor_selection: (s) => <ConstructorSelectionClient sectionContent={s} />,
    custom_book: (s) => <CustomBookPromoClient sectionContent={s} />,
    photo_print: (s) => <PhotoPrintPromoClient sectionContent={s} />,
    photobooth_promo: (s) => <PhotoboothSectionClient sectionContent={s} />,
};

export function SectionLivePreview({ section }: { section: any }) {
    const render = EXACT[section.section_name as string];
    const node = render ? render(section) : <GenericPreview section={section} />;
    const exact = Boolean(render);

    return (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
            {/* Faux browser bar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-300" />
                <span className="ml-2 text-xs font-medium text-gray-500">
                    Прев'ю — {exact ? 'як на головній' : 'приблизно як на головній'}
                </span>
            </div>
            {/* Render the real component, but inert and clipped */}
            <div
                className="overflow-auto bg-white"
                style={{ maxHeight: 560, pointerEvents: 'none', userSelect: 'none' }}
            >
                <I18nProvider initialLocale="uk">{node}</I18nProvider>
            </div>
        </div>
    );
}
