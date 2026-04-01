import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/order') // Calendars use designer order flow
}
