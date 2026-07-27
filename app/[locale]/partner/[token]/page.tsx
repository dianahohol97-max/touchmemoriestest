import PartnerCabinetClient from './PartnerCabinetClient';

export const dynamic = 'force-dynamic';

// Private, token-gated partner cabinet — never index (also disallowed in robots).
export const metadata = { robots: { index: false, follow: false } };

export default async function PartnerCabinetPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <PartnerCabinetClient token={token} />;
}
