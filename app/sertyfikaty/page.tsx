import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export default function Sertyfikaty() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px' }}>
                <div className="container">
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, marginBottom: '24px' }}>
                        Сертифікати
                    </h1>
                    <p style={{ fontSize: '18px', color: '#666' }}>
                        Розділ в розробці. Подарункові сертифікати будуть доступні незабаром.
                    </p>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
