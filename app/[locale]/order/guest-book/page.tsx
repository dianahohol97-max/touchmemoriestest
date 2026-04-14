import { redirect } from 'next/navigation';

export default function GuestBookOrderPage() {
  redirect('/order/book?product=guestbook-wedding');
}
