import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export default function HliantsevyiZhurnal() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'white' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '120px', paddingBottom: '80px' }}>
                <div className="container">
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, marginBottom: '24px' }}>
                        Глянцевий журнал
                    </h1>
                    <p style={{ fontSize: '18px', color: '#666' }}>
                        Розділ в розробці. Незабаром тут з'являться наші найкращі глянцеві журнали.
                    </p>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
