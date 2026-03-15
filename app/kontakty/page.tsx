import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';

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
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Зв'яжіться з нами</h2>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Телефон</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>+380 99 123 45 67</p>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>hello@touchmemories.com</p>
                            </div>

                            <div style={{ marginBottom: '20px' }}>
                                <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Адреса</h3>
                                <p style={{ fontSize: '18px', fontWeight: 600 }}>м. Київ, вул. Хрещатик, 1</p>
                            </div>

                            <div style={{ marginTop: '32px', height: '200px', backgroundColor: '#e2e8f0', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: '#64748b' }}>Мапа (Placeholder)</span>
                            </div>
                        </div>

                        {/* Contact Form */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>Напишіть нам</h2>
                            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Ім'я</label>
                                    <input type="text" placeholder="Ваше ім'я" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Email</label>
                                    <input type="email" placeholder="ваша@пошта.com" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px' }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 600 }}>Повідомлення</label>
                                    <textarea rows={5} placeholder="Як ми можемо допомогти?" style={{ width: '100%', padding: '12px 16px', borderRadius: '3px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '16px', resize: 'vertical' }} />
                                </div>
                                <button type="button" style={{ width: '100%', padding: '16px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '3px', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
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
