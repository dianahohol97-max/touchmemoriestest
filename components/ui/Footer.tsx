'use client';
import { useState } from 'react';
import styles from './Footer.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { Mail, Phone, Send, ChevronDown } from 'lucide-react';
import { FaInstagram, FaFacebook, FaTiktok, FaPinterest, FaThreads } from 'react-icons/fa6';
import { useTheme } from '@/components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

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
        <footer ref={ref} className="bg-white border-t border-border pt-20 pb-10 text-textPrimary">
            <div className="container mx-auto px-10">
                <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-10 md:gap-16 mb-16">
                    <div className="flex flex-col">
                        <h3 className="font-heading font-black text-2xl mb-6 tracking-wider text-primary uppercase">
                            {content['footer_brand_name'] || 'TOUCH.MEMORIES'}
                        </h3>
                        <p className="font-body text-[15px] leading-relaxed opacity-70 mb-8 max-w-sm">
                            {content['footer_brand_desc'] || "Ми віримо, що найкращі моменти життя заслуговують бути надрукованими на папері. Створюємо преміальні фотокниги з любов'ю."}
                        </p>
                        <div className="flex gap-5 flex-wrap">
                            {[
                                { url: content['footer_social_insta'], icon: <FaInstagram size={18} /> },
                                { url: content['footer_social_fb'], icon: <FaFacebook size={18} /> },
                                { url: content['footer_social_tg'], icon: <Send size={18} /> },
                                { url: content['footer_social_tiktok'], icon: <FaTiktok size={18} /> },
                                { url: content['footer_social_pinterest'], icon: <FaPinterest size={18} /> },
                                { url: content['footer_social_threads'], icon: <FaThreads size={18} /> }
                            ].map((social, i) => social.url ? (
                                <a
                                    key={i}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary opacity-80 hover:opacity-100 transition-opacity"
                                >
                                    {social.icon}
                                </a>
                            ) : null)}
                        </div>
                    </div>

                    <div className="md:hidden space-y-2 border-y border-border py-4">
                        {footerSections.map((section) => (
                            <div key={section.id} className="border-b border-border/50 last:border-none">
                                <button
                                    className="w-full flex justify-between items-center py-4 text-left font-heading font-bold text-sm uppercase tracking-widest text-primary"
                                    onClick={() => toggleSection(section.id)}
                                >
                                    <span>{section.title}</span>
                                    <ChevronDown size={18} className={cn("transition-transform duration-300", openSection === section.id ? "rotate-180" : "")} />
                                </button>
                                <AnimatePresence>
                                    {openSection === section.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="overflow-hidden pb-4"
                                        >
                                            {section.links ? (
                                                <ul className="flex flex-col gap-3">
                                                    {section.links.map((link: any, idx: number) => (
                                                        <li key={idx}>
                                                            <Link href={link.href} className="font-body text-[14px] text-textPrimary/70 hover:text-primary no-underline transition-colors">{link.label}</Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-[14px] text-textPrimary/70">
                                                    {section.content}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>

                    {footerSections.map((section) => (
                        <div key={section.id} className="hidden md:block">
                            <h4 className="font-heading font-bold text-[13px] uppercase tracking-widest text-primary mb-8">
                                {section.title}
                            </h4>
                            {section.links ? (
                                <ul className="flex flex-col gap-4">
                                    {section.links.map((link: any, idx: number) => (
                                        <li key={idx}>
                                            <Link href={link.href} className="font-body text-[14px] text-textPrimary/70 hover:text-primary no-underline transition-colors">
                                                {link.label}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="text-[14px] text-textPrimary/70">
                                    {section.content}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div className="pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-6">
                    <p className="text-[12px] text-textPrimary/40 m-0">
                        &copy; 2026 {content['footer_copyright'] || 'TOUCH.MEMORIES'}. Всі права захищені.
                    </p>
                    <div className="flex gap-8 text-[12px] text-textPrimary/40">
                        <Link href="/privacy-policy" className="hover:text-primary transition-colors no-underline">Політика конфіденційності</Link>
                        <Link href="/public-offer" className="hover:text-primary transition-colors no-underline">Публічна оферта</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
}
