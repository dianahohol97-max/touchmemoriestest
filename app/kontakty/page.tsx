import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

export const metadata = {
  title: 'Контакти | Touch.Memories',
  description: 'Зв\'яжіться з Touch.Memories: Тернопіль, вул. Київська 2. Telegram @touchmemories, email touch.memories3@gmail.com.',
};

export default function Kontakty() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '160px', paddingBottom: '80px' }}>
                <div className="container" style={{ maxWidth: '1000px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, marginBottom: '40px', textAlign: 'center' }}>
                        Наші контакти
                    </h1>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '40px' }}>
                        {/* Info Block */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: "3px", boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Зв'яжіться з нами</h2>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>touch.memories3@gmail.com</p>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Адреса</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>Тернопіль, вул. Київська 2</p>
                            </div>

                            <div className="flex flex-col gap-3 mt-4">
                                <a href="https://t.me/touchmemories" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-blue-600 hover:underline font-medium">
                                    💬 Telegram: @touchmemories
                                </a>
                                <a href="https://instagram.com/touch.memories" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-pink-600 hover:underline font-medium">
                                    📸 Instagram: @touch.memories
                                </a>
                                <a href="https://tiktok.com/touch.memories" target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-stone-800 hover:underline font-medium">
                                    🎵 TikTok: @touch.memories
                                </a>
                            </div>

                            <div style={{ marginTop: '32px', borderRadius: "12px", overflow: 'hidden' }}>
                                <iframe
                                    src="https://maps.google.com/maps?q=%D0%A2%D0%B5%D1%80%D0%BD%D0%BE%D0%BF%D1%96%D0%BB%D1%8C%2C+%D0%B2%D1%83%D0%BB.+%D0%9A%D0%B8%D1%97%D0%B2%D1%81%D1%8C%D0%BA%D0%B0+2&output=embed"
                                    width="100%"
                                    height="320"
                                    style={{ border: 0, borderRadius: '12px' }}
                                    allowFullScreen={true}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                ></iframe>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: "3px", boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Напишіть нам</h2>
                            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Ім'я</label>
                                    <input type="text" placeholder="Ваше ім'я" style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Email</label>
                                    <input type="email" placeholder="ваша@пошта.com" style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Повідомлення</label>
                                    <textarea rows={5} placeholder="Як ми можемо допомогти?" style={{ width: '100%', padding: '12px 16px', borderRadius: "3px", border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px', resize: 'vertical' }} />
                                </div>
                                <button type="button" style={{ width: '100%', padding: '16px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: "3px", border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
                                    Надіслати
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
