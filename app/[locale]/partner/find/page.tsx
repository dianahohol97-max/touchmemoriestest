import PartnerFindClient from './PartnerFindClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Знайти партнерський кабінет | Touch.Memories',
  // Сторінка службова і в пошуку їй нема чого робити; заразом це на один
  // публічний слід менше для форми, яка приймає чужі адреси.
  robots: { index: false, follow: false },
};

/**
 * Відновлення доступу до партнерського кабінету: партнер вводить свою пошту і
 * отримує на неї посилання. Правила й причини — у lib/partners/find-cabinet.ts.
 */
export default function PartnerFindPage() {
  return <PartnerFindClient />;
}
