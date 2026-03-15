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

    // Parse links
    const customLinksRaw = content['footer_product_links'];
    let customLinks = [];
    try {
        if (customLinksRaw) customLinks = JSON.parse(customLinksRaw);
    } catch (e) {
        console.error('Failed to parse footer links', e);
    }

    const sections = [
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
        }
    ];

    return (
        <footer ref={ref} className="bg-white border-t border-primary/5 pt-32 pb-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

            <div className="container mx-auto px-6 lg:px-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-24">
                    {/* Brand Section */}
                    <div className="flex flex-col gap-8">
                        <Link href="/" className="inline-block group">
                            <h2 className="font-heading font-black text-[22px] tracking-[0.25em] text-primary uppercase leading-tight m-0 transition-transform group-hover:scale-105 origin-left">
                                {content['footer_brand_name'] || 'Touch.Memories'}
                            </h2>
                        </Link>
                        <p className="text-[15px] text-primary/40 font-body leading-relaxed max-w-xs">
                            {content['footer_brand_desc'] || "Зберігаємо ваші найцінніші спогади у преміальних фотокнигах та продуктах з 2018 року."}
                        </p>
                        <div className="flex gap-4">
                            {[
                                { url: content['footer_social_insta'], icon: <FaInstagram size={18} /> },
                                { url: content['footer_social_fb'], icon: <FaFacebook size={18} /> },
                                { url: content['footer_social_tg'], icon: <Send size={18} /> }
                            ].map((social, i) => social.url ? (
                                <a
                                    key={i}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 rounded-brand border border-primary/10 flex items-center justify-center text-primary hover:bg-primary hover:text-white hover:border-primary transition-all cursor-pointer shadow-sm"
                                >
                                    {social.icon}
                                </a>
                            ) : null)}
                        </div>
                    </div>

                    {/* Desktop Navigation Columns */}
                    {sections.map((section) => (
                        <div key={section.id} className="hidden lg:flex flex-col gap-8">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 m-0">
                                {section.title}
                            </h4>
                            <ul className="list-none p-0 m-0 flex flex-col gap-5">
                                {section.links.map((link: any, idx: number) => (
                                    <li key={idx}>
                                        <Link href={link.href} className="text-[15px] font-bold text-primary/50 hover:text-primary hover:translate-x-1 inline-block transition-all">
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Mobile Navigation Column */}
                    <div className="lg:hidden flex flex-col gap-4">
                        {sections.map((section) => (
                            <div key={section.id} className="border-b border-primary/5 last:border-none">
                                <button
                                    onClick={() => toggleSection(section.id)}
                                    className="w-full flex justify-between items-center py-4 text-left font-black text-[11px] uppercase tracking-[0.3em] text-primary/40"
                                >
                                    <span>{section.title}</span>
                                    <ChevronDown size={14} className={cn("transition-transform", openSection === section.id ? "rotate-180" : "")} />
                                </button>
                                <AnimatePresence>
                                    {openSection === section.id && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden pb-6"
                                        >
                                            <ul className="list-none p-0 m-0 flex flex-col gap-4">
                                                {section.links.map((link: any, idx: number) => (
                                                    <li key={idx}>
                                                        <Link href={link.href} className="text-[15px] font-bold text-primary/60">{link.label}</Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>

                    {/* Newsletter */}
                    <div className="flex flex-col gap-8">
                        <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 m-0">
                            Newsletter
                        </h4>
                        <div className="flex flex-col gap-5">
                            <div className="relative group">
                                <input
                                    type="email"
                                    placeholder="Ваш email"
                                    className="w-full bg-white border border-primary/10 rounded-brand px-6 py-4 text-[14px] outline-none shadow-[var(--shadow-premium)] focus:border-primary/20 transition-all text-primary font-medium"
                                />
                                <button className="absolute right-2 top-2 bottom-2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-5 rounded-brand hover:bg-primary/90 transition-all">
                                    OK
                                </button>
                            </div>
                            <p className="text-[12px] text-primary/30 font-body leading-relaxed max-w-[240px]">
                                Отримуйте новини про акції та нові продукти першими.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="mt-32 pt-12 border-t border-primary/5 flex flex-col md:flex-row justify-between items-center gap-8">
                    <p className="text-[12px] text-primary/20 font-bold tracking-tight m-0">
                        © {new Date().getFullYear()} {content['footer_copyright'] || 'Touch.Memories'}. Всі права захищено.
                    </p>
                    <div className="flex gap-12">
                        {[
                            { label: 'Політика конфіденційності', href: '/privacy-policy' },
                            { label: 'Публічна оферта', href: '/public-offer' }
                        ].map((link) => (
                            <Link key={link.label} href={link.href} className="text-[12px] text-primary/20 hover:text-primary transition-colors font-bold">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
