import { redirect } from 'next/navigation';

export default function CertificatesPage() {
  redirect('/catalog?category=certificates');
}
