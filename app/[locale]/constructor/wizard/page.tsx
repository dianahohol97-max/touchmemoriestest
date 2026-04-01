import { redirect } from 'next/navigation'

export default function ConstructorPage() {
  redirect('/catalog') // Wizard redirects to catalog to choose product
}
