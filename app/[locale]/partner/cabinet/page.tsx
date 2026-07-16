import { Suspense } from 'react';
import PartnerCabinetEntry from './PartnerCabinetEntry';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Вхід у партнерський кабінет | Touch.Memories',
  robots: { index: false, follow: false },
};

/**
 * Account-based entry for travel agencies / bloggers: /partner/cabinet (no
 * token). Resolves the logged-in partner's cabinet by email and forwards to
 * their token URL — so partners who lost the emailed link can still get in
 * through their account, the same way the photographer cabinet works.
 */
export default function PartnerCabinetEntryPage() {
  return (
    <Suspense fallback={null}>
      <PartnerCabinetEntry />
    </Suspense>
  );
}
