'use client';
import { useEffect, useState } from 'react';

export default function MarkdownViewer({ source }: { source: string }) {
    const [Component, setComponent] = useState<any>(null);

    useEffect(() => {
        import('@uiw/react-md-editor').then(mod => {
            setComponent(() => mod.default.Markdown);
        });
    }, []);

    if (!source) return null;

    if (!Component) {
        // Fallback: render as plain text while loading
        return (
            <div style={{ fontSize: '18px', lineHeight: 1.8, color: '#374151', whiteSpace: 'pre-wrap' }}>
                {source.replace(/#+\s/g, '').replace(/\*\*/g, '').replace(/\*/g, '')}
            </div>
        );
    }

    return (
        <div data-color-mode="light" className="wmde-markdown-var" style={{ padding: 0, backgroundColor: 'transparent' }}>
            <Component
                source={source}
                style={{ backgroundColor: 'transparent', color: '#374151', fontSize: '18px', lineHeight: 1.8, fontFamily: 'var(--font-primary)' }}
            />
        </div>
    );
}
