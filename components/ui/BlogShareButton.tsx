'use client';
import { Link as LinkIcon, Check } from 'lucide-react';
import { useState } from 'react';

export default function BlogShareButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(() => {
            // fallback
            const input = document.createElement('input');
            input.value = url;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={handleCopy}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '40px', height: '40px', borderRadius: '3px',
                backgroundColor: copied ? '#ecfdf5' : '#f1f5f9',
                color: copied ? '#10b981' : '#64748b',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s'
            }}
            title="Скопіювати посилання"
        >
            {copied ? <Check size={18} /> : <LinkIcon size={18} />}
        </button>
    );
}
