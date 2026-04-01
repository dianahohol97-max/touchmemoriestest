// Server Component — controls route segment config for ALL /admin/* routes
// Must be a Server Component for dynamic/revalidate exports to work
import AdminLayout from './AdminLayout';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Layout({ children }: { children: React.ReactNode }) {
    return <AdminLayout>{children}</AdminLayout>;
}
