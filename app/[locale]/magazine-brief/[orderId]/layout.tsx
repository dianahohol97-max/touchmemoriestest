import type { Metadata } from 'next';

// The magazine-text brief is a private, order-scoped form (a client component,
// so it can't export metadata itself). Never index it — this segment layout
// carries the noindex; robots.txt also disallows /*/magazine-brief/.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function MagazineBriefLayout({ children }: { children: React.ReactNode }) {
  return children;
}
