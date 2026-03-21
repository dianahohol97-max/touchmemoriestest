'use client';

import { useTheme } from '@/components/providers/ThemeProvider';

export function SectionWrapper({ name, defaultOrder, children }: { name: string, defaultOrder: number, children: React.ReactNode }) {
    const { blocks, isLoading } = useTheme();

    const block = blocks.find(b => b.block_name === name);

    // If block exists and is explicitly marked invisible, don't render
    if (block && !block.is_visible) return null;

    // Use DB position_order if available, otherwise fallback
    const order = block ? block.position_order : defaultOrder;
    const style = block?.style_metadata || {};

    // Alternating background logic:
    // Odd sections (1, 3, 5...) → white (#ffffff)
    // Even sections (2, 4, 6...) → light gray-blue (#f4f6fb)
    const getDefaultBackground = (sectionOrder: number): string => {
        // If custom bg_color is set in DB, use it
        if (style.bg_color) return style.bg_color;

        // Otherwise apply alternating pattern
        return sectionOrder % 2 === 0 ? '#f4f6fb' : '#ffffff';
    };

    const sectionStyles: React.CSSProperties = {
        order,
        width: '100%',
        backgroundColor: getDefaultBackground(order),
        color: style.text_color || 'inherit',
        backgroundImage: style.bg_image ? `url(${style.bg_image})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        paddingTop: style.padding_top || '0px',
        paddingBottom: style.padding_bottom || '0px',
        borderRadius: style.border_radius || '0px',
        position: 'relative',
        overflow: 'hidden',
        // Scoped variables for components inside this section
        ['--section-heading-color' as any]: style.heading_color || style.text_color || 'inherit',
        ['--section-button-bg' as any]: style.button_bg_color || 'var(--color-primary)',
        ['--section-button-text' as any]: style.button_text_color || '#ffffff',
    };

    return (
        <div data-section={name} style={sectionStyles}>
            {children}
        </div>
    );
}
