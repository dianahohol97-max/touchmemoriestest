'use client';
import { useTheme } from '@/components/providers/ThemeProvider';

export function DynamicText({ contentKey, fallback }: { contentKey: string; fallback: string }) {
    const { content } = useTheme();
    return <>{content[contentKey] || fallback}</>;
}
