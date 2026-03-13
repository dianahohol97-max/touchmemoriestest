'use client';

import { useTheme } from '@/components/providers/ThemeProvider';

export function SectionWrapper({ name, defaultOrder, children }: { name: string, defaultOrder: number, children: React.ReactNode }) {
    const { blocks } = useTheme();
    const block = blocks.find(b => b.block_name === name);

    // If block exists and is explicitly marked invisible, don't render
    if (block && !block.is_visible) return null;

    // Use DB position_order if available, otherwise fallback
    const order = block ? block.position_order : defaultOrder;
    const style = block?.style_metadata || {};

    return (
        <div
            data-section={name}
            style={{
                order,
                width: '100%',
                backgroundColor: style.bg_color || 'transparent',
                color: style.text_color || 'inherit',
                borderRadius: style.border_radius || '0px',
                fontSize: style.font_size_modifier || '100%',
                overflow: 'hidden'
            }}>
            {children}
        </div>
    );
}
