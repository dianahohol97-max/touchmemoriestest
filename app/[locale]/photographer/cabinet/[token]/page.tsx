import CabinetClient from './CabinetClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Кабінет фотографа | Touch.Memories',
  robots: { index: false, follow: false },
};

export default async function PhotographerCabinetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CabinetClient token={token} />;
}
