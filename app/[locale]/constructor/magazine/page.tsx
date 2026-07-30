import { redirect } from 'next/navigation';

// The standalone magazine constructor was a STUB with a fake success screen:
// handleSubmit did nothing ("// In real app, send to API") and then told the
// customer "Замовлення прийнято!" — no order row, no files, no cart, no email.
// Anyone who "ordered" here believed they bought a magazine while nothing
// reached us. The real, working magazine flow is the catalog product page
// (its editor produces print files and a saved design) — send people there.
// The old constructor UI is preserved in git history (page.tsx.backup too)
// if it's ever finished for real.
export default async function MagazineConstructorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/catalog/magazine-a4`);
}
