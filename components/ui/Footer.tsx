'use client';
import { useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { Mail, Phone, Send, ChevronDown } from 'lucide-react';
import { FaInstagram, FaFacebook, FaTiktok, FaPinterest, FaThreads } from 'react-icons/fa6';
import { useTheme } from '@/components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';

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
    const [openSection, setOpenSection] = useState<string | null>(null);

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    const footerSections = [
        {
            id: 'products',
            title: 'Продукти',
            links: categories.length > 0 ? categories.map(c => ({ label: c.name, href: `/catalog?category=${c.slug}` })) : [
                { label: 'Фотокниги', href: '/catalog?category=photobooks' },
                { label: 'Глянцеві журнали', href: '/catalog?category=hlyantsevi-zhurnaly' },
                { label: 'Фотодруки', href: '/catalog?category=prints' },
                { label: 'Подарунки', href: '/catalog?category=gifts' }
            ]
        },
        {
            id: 'help',
            title: 'Допомога',
            links: [
                { label: 'Доставка та оплата', href: '/oplata-i-dostavka' },
                { label: 'Обмін та повернення', href: '/shipping-returns' },
                { label: 'Питання та відповіді', href: '/faq' },
                { label: 'Конструктор', href: '/book-constructor' }
            ]
        },
        {
            id: 'contacts',
            title: 'Контакти',
            content: (
                <ul className="footer-list">
                    {content['footer_phone'] && (
                        <li className="contact-item">
                            <Phone size={16} /> {content['footer_phone']}
                        </li>
                    )}
                    {content['footer_email'] && (
                        <li className="contact-item">
                            <Mail size={16} /> {content['footer_email']}
                        </li>
                    )}
                    {content['footer_address'] && (
                        <li className="contact-item">
                            {content['footer_address']}
                        </li>
                    )}
                </ul>
            )
        }
    ];

    return (
        <footer ref={ref} className="footer-root">
            <div className="container">
                <div className="footer-grid">
                    <div className="brand-column">
                        <h3 className="brand-title">
                            {content['footer_brand_name'] || 'TOUCH.MEMORIES'}
                        </h3>
                        <p className="brand-desc">
                            {content['footer_brand_desc'] || "Ми віримо, що найкращі моменти життя заслуговують бути надрукованими на папері. Створюємо преміальні фотокниги з любов'ю."}
                        </p>
                        <div className="social-links">
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
                                    className="social-link"
                                >
                                    {social.icon}
                                </a>
                            ) : null)}
                        </div>
                    </div>

                    <div className="mobile-accordion">
                        {footerSections.map((section) => (
                            <div key={section.id} className="accordion-item">
                                <button
                                    className="accordion-trigger"
                                    onClick={() => toggleSection(section.id)}
                                >
                                    <span>{section.title}</span>
                                    <ChevronDown size={18} className={`chevron ${openSection === section.id ? 'rotate' : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openSection === section.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="accordion-content"
                                        >
                                            {section.links ? (
                                                <ul className="footer-list">
                                                    {section.links.map((link, idx) => (
                                                        <li key={idx}>
                                                            <a href={link.href} className="footer-link">{link.label}</a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : section.content}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>

                    {footerSections.map((section) => (
                        <div key={section.id} className="desktop-section">
                            <h4 className="section-title">{section.title}</h4>
                            {section.links ? (
                                <ul className="footer-list">
                                    {section.links.map((link, idx) => (
                                        <li key={idx}>
                                            <a href={link.href} className="footer-link">{link.label}</a>
                                        </li>
                                    ))}
                                </ul>
                            ) : section.content}
                        </div>
                    ))}
                </div>

                <div className="footer-bottom">
                    <p className="copyright">
                        &copy; 2026 {content['footer_copyright'] || 'TOUCH.MEMORIES'}. Всі права захищені.
                    </p>
                    <div className="bottom-links">
                        <a href="#" className="bottom-link">Політика конфіденційності</a>
                        <a href="#" className="bottom-link">Публічна оферта</a>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .footer-root {
                    background-color: #111;
                    color: white;
                    padding: 80px 0 40px;
                }
                .footer-grid {
                    display: grid;
                    grid-template-columns: 1.5fr repeat(3, 1fr);
                    gap: 60px;
                    margin-bottom: 60px;
                }
                .brand-title {
                    font-family: var(--font-heading);
                    font-weight: 900;
                    fontSize: 1.5rem;
                    marginBottom: 24px;
                    letterSpacing: 0.05em;
                }
                .brand-desc {
                    opacity: 0.6;
                    line-height: 1.8;
                    margin-bottom: 32px;
                }
                .social-links {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                }
                .social-link {
                    color: white;
                    opacity: 0.8;
                    transition: opacity 0.2s;
                }
                .social-link:hover {
                    opacity: 1;
                }
                .section-title {
                    font-family: var(--font-heading);
                    font-weight: 700;
                    font-size: 14px;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 24px;
                }
                .footer-list {
                    list-style: none;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .footer-link {
                    color: white;
                    text-decoration: none;
                    opacity: 0.6;
                    transition: opacity 0.2s;
                }
                .footer-link:hover {
                    opacity: 1;
                }
                .contact-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    opacity: 0.6;
                }
                .mobile-accordion {
                    display: none;
                }
                .footer-bottom {
                    border-top: 1px solid rgba(255,255,255,0.1);
                    padding-top: 40px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 20px;
                }
                .copyright {
                    opacity: 0.4;
                    font-size: 12px;
                    margin: 0;
                }
                .bottom-links {
                    display: flex;
                    gap: 30px;
                    opacity: 0.4;
                    font-size: 12px;
                }
                .bottom-link {
                    color: white;
                    text-decoration: none;
                }

                @media (max-width: 768px) {
                    .footer-root {
                        padding: 60px 0 40px;
                    }
                    .footer-grid {
                        grid-template-columns: 1fr;
                        gap: 40px;
                        margin-bottom: 40px;
                        text-align: center;
                    }
                    .brand-column {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .social-links {
                        justify-content: center;
                        gap: 24px;
                    }
                    .desktop-section {
                        display: none;
                    }
                    .mobile-accordion {
                        display: block;
                        text-align: left;
                        border-top: 1px solid rgba(255,255,255,0.1);
                        border-bottom: 1px solid rgba(255,255,255,0.1);
                    }
                    .accordion-item {
                        border-bottom: 1px solid rgba(255,255,255,0.05);
                    }
                    .accordion-item:last-child {
                        border-bottom: none;
                    }
                    .accordion-trigger {
                        width: 100%;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 20px 0;
                        background: none;
                        border: none;
                        color: white;
                        font-family: var(--font-heading);
                        font-weight: 700;
                        font-size: 16px;
                        cursor: pointer;
                    }
                    .accordion-content {
                        overflow: hidden;
                        padding-bottom: 20px;
                    }
                    .chevron {
                        transition: transform 0.3s;
                    }
                    .chevron.rotate {
                        transform: rotate(180deg);
                    }
                    .footer-bottom {
                        flex-direction: column;
                        text-align: center;
                        padding-top: 32px;
                    }
                    .bottom-links {
                        justify-content: center;
                        gap: 20px;
                        flex-direction: column;
                    }
                }
            `}</style>
        </footer>
    );
}
