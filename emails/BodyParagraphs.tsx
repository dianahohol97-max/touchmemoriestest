import { Text } from '@react-email/components';
import * as React from 'react';

// Renders admin-edited body text (blank-line separated) as brand paragraphs.
export function BodyParagraphs({ text, className }: { text: string; className?: string }) {
    const parts = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    return (
        <>
            {parts.map((p, i) => (
                <Text key={i} className={className}>{p}</Text>
            ))}
        </>
    );
}
