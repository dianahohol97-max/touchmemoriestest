'use client';

import MarkdownViewer from '@/components/ui/MarkdownViewer';

export function LegalContent({
  title,
  content,
  showFallbackNotice,
}: {
  title: string;
  content: string;
  showFallbackNotice?: boolean;
}) {
  return (
    <div>
      {showFallbackNotice && (
        <div style={{
          padding: '16px 20px',
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          marginBottom: 24,
          fontSize: 14,
          color: '#1e40af',
          lineHeight: 1.6,
        }}>
          This document is currently available only in Ukrainian. A translation to your language will appear soon.
        </div>
      )}
      <h1 style={{ fontSize: 32, fontWeight: 900, color: '#1e2d7d', marginBottom: 32, letterSpacing: '-0.02em' }}>
        {title}
      </h1>
      <MarkdownViewer source={content} />
    </div>
  );
}
