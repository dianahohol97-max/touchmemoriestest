import { Suspense } from 'react';
import CabinetEntry from './CabinetEntry';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Вхід у кабінет фотографа | Touch.Memories',
  robots: { index: false, follow: false },
};

/**
 * Memorable cabinet entry: /uk/photographer/cabinet (no token). Resolves the
 * logged-in user's cabinet and forwards to their token URL — so photographers
 * who lost the emailed link can still get in via their account.
 */
export default function PhotographerCabinetEntryPage() {
  return (
    <Suspense fallback={null}>
      <CabinetEntry />
    </Suspense>
  );
}
