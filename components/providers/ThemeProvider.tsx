'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ThemeContextType = {
    theme: any;
    blocks: any[];
    content: Record<string, string>;
    isLoading: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
    theme: {},
    blocks: [],
    content: {},
    isLoading: true,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<any>({});
    const [blocks, setBlocks] = useState<any[]>([]);
    const [contentMap, setContentMap] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);

    const supabase = createClient();

    useEffect(() => {
        // 1. Initial Fetch
        const fetchData = async () => {
            try {
                const [themeRes, blocksRes, contentRes] = await Promise.all([
                    supabase.from('theme_settings').select('*').limit(1).single(),
                    supabase.from('site_blocks').select('*').order('position_order', { ascending: true }),
                    supabase.from('site_content').select('*')
                ]);

                if (themeRes.data) setTheme(themeRes.data);
                if (blocksRes.data) setBlocks(blocksRes.data);

                if (contentRes.data) {
                    const map: Record<string, string> = {};
                    contentRes.data.forEach((c: any) => { map[c.key] = c.value; });
                    setContentMap(map);
                }
            } catch (e) {
                console.error('Failed to fetch theme data:', e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();

        // 2. Listen for Live Preview updates from iframe parent
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'VISUAL_PREVIEW_UPDATE') {
                if (event.data.theme) setTheme(event.data.theme);
                if (event.data.blocks) setBlocks(event.data.blocks);
                if (event.data.content) {
                    // content array to map
                    const map: Record<string, string> = {};
                    event.data.content.forEach((c: any) => { map[c.key] = c.value; });
                    setContentMap(map);
                }
            }
        };
        window.addEventListener('message', handleMessage);

        return () => window.removeEventListener('message', handleMessage);
    }, []);

    // 3. Apply CSS Variables when theme changes
    useEffect(() => {
        if (!theme.color_primary) return;

        const root = document.documentElement;
        root.style.setProperty('--color-primary', theme.color_primary);
        root.style.setProperty('--color-secondary', theme.color_secondary);
        root.style.setProperty('--color-accent', theme.color_accent);
        root.style.setProperty('--color-background', theme.color_background);
        root.style.setProperty('--color-text', theme.color_text);

        root.style.setProperty('--border-radius', `${theme.border_radius || 0}px`);
        root.style.setProperty('--spacing-unit', `${theme.spacing_unit || 4}px`);

        // Card settings
        if (theme.card_settings) {
            const cs = theme.card_settings;
            root.style.setProperty('--card-radius', cs.card_border_radius || '12px');
            root.style.setProperty('--card-bg', cs.card_bg_color || '#ffffff');
            root.style.setProperty('--card-text', cs.card_text_color || '#0f172a');
            root.style.setProperty('--card-shadow', cs.card_shadow || '0 4px 6px -1px rgb(0 0 0 / 0.1)');
            root.style.setProperty('--card-aspect-category', cs.category_card_aspect || '3/4');
            root.style.setProperty('--card-aspect-product', cs.product_card_aspect || '1/1');
        }

        // Typography
        if (theme.typography) {
            const ty = theme.typography;
            if (ty.heading_font) {
                let hFont = ty.heading_font;
                if (hFont === 'Montserrat') hFont = 'var(--font-montserrat), sans-serif';
                else if (hFont === 'Open Sans') hFont = 'var(--font-open-sans), sans-serif';
                root.style.setProperty('--font-heading', hFont);
            }
            if (ty.body_font) {
                let bFont = ty.body_font;
                if (bFont === 'Open Sans') bFont = 'var(--font-open-sans), sans-serif';
                else if (bFont === 'Inter') bFont = 'var(--font-inter), sans-serif';
                else if (bFont === 'TouchMemories Main') bFont = '"TouchMemories Main", sans-serif';
                root.style.setProperty('--font-body', bFont);
            }
        } else {
            // Fallback for legacy fields
            if (theme.font_family_body === 'Open Sans') {
                root.style.setProperty('--font-body', `var(--font-open-sans), sans-serif`);
            } else {
                root.style.setProperty('--font-body', `var(--font-geist-sans), sans-serif`);
            }
            root.style.setProperty('--font-heading', `var(--font-geist-sans), sans-serif`);
        }

    }, [theme]);

    // Make body background dynamic
    useEffect(() => {
        if (theme.color_background) {
            document.body.style.backgroundColor = theme.color_background;
            document.body.style.color = theme.color_text;
        }
    }, [theme.color_background, theme.color_text]);

    return (
        <ThemeContext.Provider value={{ theme, blocks, content: contentMap, isLoading }}>
            {children}
        </ThemeContext.Provider>
    );
}
