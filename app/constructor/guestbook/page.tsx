import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/editor/new?product=guestbook&format=20x30&pages=32')
}
