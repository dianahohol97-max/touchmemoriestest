'use client';
import { useInView } from 'react-intersection-observer';
import { Mail, Phone, Send } from 'lucide-react';
import { FaInstagram, FaFacebook, FaTiktok, FaPinterest, FaThreads } from 'react-icons/fa6';
import { useTheme } from '@/components/providers/ThemeProvider';

interface Category {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
}

interface FooterProps {
    categories?: Category[];
}

export function Footer({ categories = [] }: FooterProps) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const { content } = useTheme();

    return (
        <footer ref={ref} style={{ backgroundColor: '#111', color: 'white', padding: '100px 0 40px' }}>
            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '60px', marginBottom: '80px' }}>
                    <div>
                        <h3 style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '1.5rem', marginBottom: '24px', letterSpacing: '0.05em' }}>
                            {content['footer_brand_name'] || 'TOUCH.MEMORIES'}
                        </h3>
                        <p style={{ opacity: 0.6, lineHeight: 1.8, marginBottom: '32px' }}>
                            {content['footer_brand_desc'] || "Ми віримо, що найкращі моменти життя заслуговують бути надрукованими на папері. Створюємо преміальні фотокниги з любов'ю."}
                        </p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {[
                                { url: content['footer_social_insta'], icon: <FaInstagram size={20} /> },
                                { url: content['footer_social_fb'], icon: <FaFacebook size={20} /> },
                                { url: content['footer_social_tg'], icon: <Send size={20} /> },
                                { url: content['footer_social_tiktok'], icon: <FaTiktok size={20} /> },
                                { url: content['footer_social_pinterest'], icon: <FaPinterest size={20} /> },
                                { url: content['footer_social_threads'], icon: <FaThreads size={20} /> }
                            ].map((social, i) => social.url ? (
                                <a
                                    key={i}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'white', opacity: 0.8, transition: 'opacity 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.8'}
                                >
                                    {social.icon}
                                </a>
                            ) : null)}
                        </div>
                    </div>

                    <div>
                        <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
                            Продукти
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {categories.length > 0 ? (
                                categories.map((category) => (
                                    <li key={category.id}>
                                        <a
                                            href={`/catalog?category=${category.slug}`}
                                            style={{ color: 'white', textDecoration: 'none', opacity: 0.6, transition: 'opacity 0.2s' }}
                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                                        >
                                            {category.name}
                                        </a>
                                    </li>
                                ))
                            ) : (
                                <>
                                    <li><a href="/catalog?category=photobooks" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Фотокниги</a></li>
                                    <li><a href="/catalog?category=hlyantsevi-zhurnaly" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Глянцеві журнали</a></li>
                                    <li><a href="/catalog?category=prints" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Фотодруки</a></li>
                                    <li><a href="/catalog?category=gifts" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Подарунки</a></li>
                                </>
                            )}
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
                            Допомога
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <li><a href="/oplata-i-dostavka" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Доставка та оплата</a></li>
                            <li><a href="/shipping-returns" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Обмін та повернення</a></li>
                            <li><a href="/faq" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Питання та відповіді</a></li>
                            <li><a href="/constructor" style={{ color: 'white', textDecoration: 'none', opacity: 0.6 }}>Конструктор</a></li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '24px' }}>
                            Контакти
                        </h4>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {content['footer_phone'] && (
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
                                    <Phone size={16} /> {content['footer_phone']}
                                </li>
                            )}
                            {content['footer_email'] && (
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
                                    <Mail size={16} /> {content['footer_email']}
                                </li>
                            )}
                            {content['footer_address'] && (
                                <li style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
                                    {content['footer_address']}
                                </li>
                            )}
                        </ul>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <p style={{ opacity: 0.4, fontSize: '12px', margin: 0 }}>
                        &copy; 2026 {content['footer_copyright'] || 'TOUCH.MEMORIES'}. Всі права захищені.
                    </p>
                    <div style={{ display: 'flex', gap: '30px', opacity: 0.4, fontSize: '12px' }}>
                        <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Політика конфіденційності</a>
                        <a href="#" style={{ color: 'white', textDecoration: 'none' }}>Публічна оферта</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
