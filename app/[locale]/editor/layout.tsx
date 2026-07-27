import type { Metadata } from 'next';

// The editor is a private authoring surface (project/book/poster editors), not
// public content. Never index it; robots.txt also disallows /*/editor.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
