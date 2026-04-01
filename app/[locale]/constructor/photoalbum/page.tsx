import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/order/book?product=photoalbum')
}
