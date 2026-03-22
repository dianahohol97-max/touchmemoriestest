import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/order') // Magnets use designer order flow
}
