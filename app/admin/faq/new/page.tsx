import AdminFaqForm from '@/components/admin/AdminFaqForm';

export default function NewFaqPage() {
    return (
        <div style={{ padding: '0 0 80px' }}>
            <AdminFaqForm isEditing={false} />
        </div>
    );
}
