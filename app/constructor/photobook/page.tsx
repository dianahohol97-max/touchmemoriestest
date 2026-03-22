import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/editor/new?product=photobook&format=20x20&pages=20')
}
