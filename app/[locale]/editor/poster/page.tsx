import { redirect } from 'next/navigation';

// The live poster flow is /order/poster (PosterConstructor), which attaches the
// composed poster + photos to the order via an export descriptor. The older
// PosterEditor here added to cart WITHOUT that descriptor, so poster orders made
// through it lost their design. Redirect to the working flow.
export default function PosterEditorPage() {
  redirect('/order/poster');
}
