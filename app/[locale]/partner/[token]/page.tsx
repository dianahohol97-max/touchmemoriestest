import PartnerCabinetClient from './PartnerCabinetClient';

export const dynamic = 'force-dynamic';

export default async function PartnerCabinetPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    return <PartnerCabinetClient token={token} />;
}
