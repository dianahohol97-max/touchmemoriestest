import { Suspense } from 'react';
import WeddingAgencyCabinet from './WeddingAgencyCabinet';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Кабінет весільної агенції | Touch.Memories',
  robots: { index: false, follow: false },
};

/**
 * Account-gated cabinet for wedding agencies: /wedding-agency/cabinet.
 * Resolves the logged-in partner's B2B discount status — the same login-based
 * entry the photographer cabinet uses, so agencies reach their cabinet through
 * their account instead of a saved link.
 */
export default function WeddingAgencyCabinetPage() {
  return (
    <Suspense fallback={null}>
      <WeddingAgencyCabinet />
    </Suspense>
  );
}
