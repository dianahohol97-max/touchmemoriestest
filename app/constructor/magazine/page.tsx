import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/editor/new?product=magazine&format=A4&pages=12')
}
