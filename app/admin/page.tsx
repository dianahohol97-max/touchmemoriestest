// Server Component wrapper — forces dynamic rendering for the admin dashboard
// This prevents Next.js from statically pre-rendering the page with the loading spinner
import { Suspense } from 'react';
import AdminDashboard from './AdminDashboard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminPage() {
    return (
        <Suspense fallback={null}>
            <AdminDashboard />
        </Suspense>
    );
}
