import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/editor/new?product=wishbook&format=20x30&pages=32')
}
