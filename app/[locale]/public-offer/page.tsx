'use client';
import { useTheme } from '@/components/providers/ThemeProvider';
import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { motion } from 'framer-motion';

export default function PublicOfferPage() {
    const { content } = useTheme();
    const offerContent = content['public_offer'] || '# Публічна оферта\n\nКонтент ще не додано через адмін панель.';

    return (
        <main style={{ minHeight: '100vh', backgroundColor: '#fff' }}>
            <Navigation />

            <section style={{ paddingTop: '120px', paddingBottom: '80px' }}>
                <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="prose prose-slate max-w-none"
                    >
                        <div dangerouslySetInnerHTML={{ __html: offerContent }} />
                    </motion.div>
                </div>
            </section>

            <Footer />
        </main>
    );
}
