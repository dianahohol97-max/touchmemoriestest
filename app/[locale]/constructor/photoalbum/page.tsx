import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/catalog') // no single "photoalbum" product — let the customer pick an album
}
