import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Online Photobooth',
  description: 'Take photos and create printable layouts',
};

export default function PhotoboothLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
