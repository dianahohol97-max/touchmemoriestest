import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/editor/new?product=photoalbum&format=23x23&pages=32')
}
