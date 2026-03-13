'use client';
import MDEditor from '@uiw/react-md-editor';

export default function MarkdownViewer({ source }: { source: string }) {
    return (
        <div data-color-mode="light" className="wmde-markdown-var" style={{ padding: 0, backgroundColor: 'transparent' }}>
            <MDEditor.Markdown source={source} style={{ backgroundColor: 'transparent', color: '#334155', fontSize: '18px', lineHeight: 1.8, fontFamily: 'var(--font-primary)' }} />
        </div>
    );
}
