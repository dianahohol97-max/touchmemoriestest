// Server Component — controls route segment config for ALL /admin/* routes
// Must be a Server Component for dynamic/revalidate exports to work.
//
// The actual auth gating for /admin/* is performed by the root middleware
// (middleware.ts) which redirects unauthenticated/non-admin users to
// /admin/login before this layout ever renders. The middleware-level
// guard is the source of truth; PermissionsContext on the client side is
// only for menu filtering.

import AdminLayout from './AdminLayout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Layout({ children }: { children: React.ReactNode }) {
    return <AdminLayout>{children}</AdminLayout>;
}
