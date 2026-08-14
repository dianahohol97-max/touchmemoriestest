import type { Metadata } from 'next';
import UploadClient from './UploadClient';

export const dynamic = 'force-dynamic';

// A private link: it must never end up in search results or in a referrer.
export const metadata: Metadata = {
    title: 'Завантаження фото — touch.memories',
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
};

export default async function UploadPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <UploadClient token={token} />;
}
