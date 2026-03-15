import { Navigation } from '@/components/ui/Navigation';
import { Footer } from '@/components/ui/Footer';
import { CreditCard, Truck } from 'lucide-react';

export default function OplataIDostavka() {
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
            <Navigation />
            <main style={{ flex: 1, paddingTop: '160px', paddingBottom: '80px' }}>
                <div className="container" style={{ maxWidth: '800px' }}>
                    <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '48px', fontWeight: 900, marginBottom: '40px', textAlign: 'center' }}>
                        Оплата і доставка
                    </h1>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
                        {/* Payment Options */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: '#eff6ff', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CreditCard size={24} color="#263A99" />
                                </div>
                                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Способи оплати</h2>
                            </div>

                            <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '3px', backgroundColor: '#263A99', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>1</div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Банківською картою онлайн</h3>
                                        <p style={{ color: '#666', lineHeight: 1.5 }}>Безпечна оплата через систему Monobank. Приймаються картки Visa та MasterCard будь-якого банку.</p>
                                    </div>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '3px', backgroundColor: '#263A99', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>2</div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Apple Pay / Google Pay</h3>
                                        <p style={{ color: '#666', lineHeight: 1.5 }}>Швидка та безпечна оплата в один клік зі смартфона або комп'ютера через сервіс Monobank.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Delivery Options */}
                        <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '3px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ width: '48px', height: '48px', backgroundColor: '#f0fdf4', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Truck size={24} color="#22c55e" />
                                </div>
                                <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Умови доставки</h2>
                            </div>

                            <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '3px', backgroundColor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>1</div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Нова Пошта (відділення або поштомат)</h3>
                                        <p style={{ color: '#666', lineHeight: 1.5 }}>Термін доставки: 1-2 дні з моменту відправки. Вартість розраховується за тарифами перевізника.</p>
                                    </div>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '3px', backgroundColor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>2</div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Адресна доставка кур'єром</h3>
                                        <p style={{ color: '#666', lineHeight: 1.5 }}>Доставка до дверей кур'єром Нової Пошти.</p>
                                    </div>
                                </li>
                                <li style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '3px', backgroundColor: '#22c55e', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0, marginTop: '2px' }}>3</div>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>Безкоштовна доставка</h3>
                                        <p style={{ color: '#666', lineHeight: 1.5 }}>Діє для замовлень на суму від 2000 грн.</p>
                                    </div>
                                </li>
                            </ul>

                            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#fff7ed', borderRadius: '3px', borderLeft: '4px solid #f97316' }}>
                                <p style={{ fontSize: '14px', color: '#9a3412', margin: 0 }}><strong>Зверніть увагу:</strong> Терміни виготовлення фотокниг складають 3-5 робочих днів до моменту відправки.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
            <Footer categories={[]} />
        </div>
    );
}
