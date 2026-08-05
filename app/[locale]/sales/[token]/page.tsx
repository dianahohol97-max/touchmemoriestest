import SalesCabinetClient from './SalesCabinetClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Кабінет менеджера | Touch.Memories',
  robots: { index: false, follow: false },
};

export default async function SalesCabinetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SalesCabinetClient token={token} />;
}
