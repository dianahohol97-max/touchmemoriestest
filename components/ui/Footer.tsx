'use client';
import { useState } from 'react';
import styles from './Footer.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
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

    const { content, blocks } = useTheme();
    const [openSection, setOpenSection] = useState<string | null>(null);
    const footerBlock = blocks.find(b => b.block_name === 'footer');
    const footerStyle = footerBlock?.style_metadata || {};

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    // Custom product links from content or categories
    const customLinksRaw = content['footer_product_links'];
    let customLinks = [];
    try {
        if (customLinksRaw) customLinks = JSON.parse(customLinksRaw);
    } catch (e) {
        console.error('Failed to parse footer links', e);
    }

    const footerSections = [
        {
            id: 'products',
            title: 'Продукти',
            links: customLinks.length > 0 ? customLinks : (categories.length > 0 ? categories.map(c => ({ label: c.name, href: `/catalog?category=${c.slug}` })) : [
                { label: 'Фотокниги', href: '/catalog?category=photobooks' },
                { label: 'Глянцеві журнали', href: '/catalog?category=hlyantsevi-zhurnaly' },
                { label: 'Фотоdruки', href: '/catalog?category=prints' }
            ])
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
                <ul className={styles.footerList}>
                    {content['footer_phone'] && (
                        <li className={styles.contactItem}>
                            <Phone size={16} /> {content['footer_phone']}
                        </li>
                    )}
                    {content['footer_email'] && (
                        <li className={styles.contactItem}>
                            <Mail size={16} /> {content['footer_email']}
                        </li>
                    )}
                    {content['footer_address'] && (
                        <li className={styles.contactItem}>
                            {content['footer_address']}
                        </li>
                    )}
                </ul>
            )
        }
    ];

    return (
        <footer ref={ref} className={styles.footerRoot} style={{
            backgroundColor: footerStyle.bg_color || '#111',
            color: footerStyle.text_color || '#fff'
        }}>
            <div className="container">
                <div className={styles.footerGrid}>
                    <div className={styles.brandColumn}>
                        <h3 className={styles.brandTitle}>
                            {content['footer_brand_name'] || 'TOUCH.MEMORIES'}
                        </h3>
                        <p className={styles.brandDesc}>
                            {content['footer_brand_desc'] || "Ми віримо, що найкращі моменти життя заслуговують бути надрукованими на папері. Створюємо преміальні фотокниги з любов'ю."}
                        </p>
                        <div className={styles.socialLinks}>
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
                                    className={styles.socialLink}
                                >
                                    {social.icon}
                                </a>
                            ) : null)}
                        </div>
                    </div>

                    <div className={styles.mobileAccordion}>
                        {footerSections.map((section) => (
                            <div key={section.id} className={styles.accordionItem}>
                                <button
                                    className={styles.accordionTrigger}
                                    onClick={() => toggleSection(section.id)}
                                    style={{ color: 'inherit' }}
                                >
                                    <span>{section.title}</span>
                                    <ChevronDown size={18} className={`${styles.chevron} ${openSection === section.id ? styles.rotate : ''}`} />
                                </button>
                                <AnimatePresence>
                                    {openSection === section.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className={styles.accordionContent}
                                        >
                                            {section.links ? (
                                                <ul className={styles.footerList}>
                                                    {section.links.map((link: any, idx: number) => (
                                                        <li key={idx}>
                                                            <Link href={link.href} className={styles.footerLink} style={{ color: 'inherit' }}>{link.label}</Link>
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
                        <div key={section.id} className={styles.desktopSection}>
                            <h4 className={styles.sectionTitle}>{section.title}</h4>
                            {section.links ? (
                                <ul className={styles.footerList}>
                                    {section.links.map((link: any, idx: number) => (
                                        <li key={idx}>
                                            <Link href={link.href} className={styles.footerLink} style={{ color: 'inherit' }}>{link.label}</Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : section.content}
                        </div>
                    ))}
                </div>

                <div className={styles.footerBottom}>
                    <p className={styles.copyright} style={{ color: 'inherit', opacity: 0.4 }}>
                        &copy; 2026 {content['footer_copyright'] || 'TOUCH.MEMORIES'}. Всі права захищені.
                    </p>
                    <div className={styles.bottomLinks}>
                        <Link href="/privacy-policy" className={styles.bottomLink} style={{ color: 'inherit' }}>Політика конфіденційності</Link>
                        <Link href="/public-offer" className={styles.bottomLink} style={{ color: 'inherit' }}>Публічна оферта</Link>
                    </div>
                </div>
            </div>

        </footer>
    );
}
