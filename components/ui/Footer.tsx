'use client';
import { useT } from '@/lib/i18n/context';
import { useState, useEffect } from 'react';
import styles from './Footer.module.css';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { Mail, Phone, Send, ChevronDown, MapPin } from 'lucide-react';
import { FaInstagram, FaFacebook, FaTiktok, FaPinterest, FaThreads, FaTelegram } from 'react-icons/fa6';
import { useTheme } from '@/components/providers/ThemeProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface Category {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
}

interface FooterProps {
    categories?: Category[];
}

function NewsletterFormFooter() {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch('/api/subscribers/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, source: 'footer' })
            });

            if (res.ok) {
                setSubscribed(true);
                setEmail('');
            }
        } catch (err) {
            console.error('Newsletter subscription error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 m-0">
                Newsletter
            </h4>
            <div className="flex flex-col gap-4">
                {subscribed ? (
                    <p className="text-green-600 text-sm font-medium">{t('ui.subscribe_thanks')}</p>
                ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                        <input
                            type="email"
                            required
                            placeholder="Ваш email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                            className="flex-1 bg-white border border-primary/5 rounded-brand px-4 py-3 text-[14px] outline-none shadow-sm focus:border-primary/20 transition-all text-primary disabled:opacity-50"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-[#1e2d7d] text-white rounded-full font-bold text-sm whitespace-nowrap flex-shrink-0 hover:bg-[#152158] shadow-[0_4px_16px_rgba(38,58,153,0.35)] transition-all duration-200 disabled:opacity-50"
                        >
                            {loading ? '...' : t('ui.subscribe')}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export function Footer({ categories = [] }: FooterProps) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const { content, blocks } = useTheme();
  const t = useT();
    const [openSection, setOpenSection] = useState<string | null>(null);
    const [sections, setSections] = useState<any[]>([]);
    const footerBlock = blocks.find(b => b.block_name === 'footer');
    const footerStyle = footerBlock?.style_metadata || {};

    const toggleSection = (section: string) => {
        setOpenSection(openSection === section ? null : section);
    };

    // Fetch footer sections and links from database
    useEffect(() => {
        async function fetchFooterData() {
            const supabase = createClient();

            const { data: footerSections } = await supabase
                .from('footer_sections')
                .select(`
                    id,
                    section_name,
                    section_title,
                    footer_links (
                        id,
                        link_text,
                        link_url,
                        display_order,
                        is_active
                    )
                `)
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (footerSections && footerSections.length > 0) {
                const formattedSections = footerSections.map(section => ({
                    id: section.section_name,
                    title: section.section_title,
                    links: (section.footer_links as any[])
                        .filter(link => link.is_active)
                        .sort((a, b) => a.display_order - b.display_order)
                        .map(link => ({ label: link.link_text, href: link.link_url }))
                }));
                setSections(formattedSections);
            } else {
                // Fallback to defaults
                setSections([
                    {
                        id: 'products',
                        title: 'Продукти',
                        links: [
                            { label: 'Фотокниги', href: '/catalog?category=photobooks' },
                            { label: 'Глянцеві журнали', href: '/catalog?category=hlyantsevi-zhurnaly' },
                            { label: 'Фотодрук', href: '/catalog?category=prints' }
                        ]
                    },
                    {
                        id: 'help',
                        title: 'Допомога',
                        links: [
                            { label: t('footer.delivery'), href: '/shipping-returns' },
                            { label: 'Питання та відповіді', href: '/faq' },
                            { label: 'Конструктор', href: '/constructor/photobook' }
                        ]
                    },
                    {
                        id: 'contacts',
                        title: t('footer.contacts'),
                        links: [
                            { label: 'touch.memories3@gmail.com', href: 'mailto:touch.memories3@gmail.com' },
                            { label: 'Тернопіль, вул. Київська 2', href: 'https://maps.google.com/?q=Тернопіль,+вул.+Київська+2' },
                            { label: 'Telegram: @touchmemories', href: 'https://t.me/touchmemories' },
                            { label: 'Instagram: @touch.memories', href: 'https://instagram.com/touch.memories' },
                            { label: 'TikTok: @touch.memories', href: 'https://tiktok.com/@touch.memories' }
                        ]
                    }
                ]);
            }
        }
        fetchFooterData();
    }, []);

    return (
        <footer ref={ref} className="bg-premium-gradient border-t border-primary/5 pt-16 pb-12 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />

            <div className="container mx-auto px-6 lg:px-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-12 lg:gap-16">
                    {/* Brand Section */}
                    <div className="lg:col-span-2 flex flex-col gap-6 lg:pr-12">
                        <Link href="/" className="inline-block group">
                            <h2 className="font-heading font-black text-[22px] tracking-[0.2em] text-primary uppercase leading-tight m-0 transition-transform group-hover:scale-105 origin-left">
                                {content['footer_brand_name'] || 'Touch.Memories'}
                            </h2>
                        </Link>
                        <p className="text-[14px] text-primary/60 font-body leading-relaxed max-w-sm">
                            {content['footer_brand_desc'] || "Зберігаємо ваші найцінніші спогади у преміальних фотокнигах та продуктах з 2018 року."}
                        </p>
                        
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-stone-500 mt-2 flex items-center gap-2">
                                <MapPin size={14} /> Тернопіль, вул. Київська 2
                            </p>
                            <p className="text-sm text-stone-500 flex items-center gap-2">
                                <Mail size={14} /> touch.memories3@gmail.com
                            </p>
                        </div>

                        <div className="flex gap-4 mt-4">
                            <a href="https://t.me/touchmemories" target="_blank" rel="noopener noreferrer"
                               aria-label="Telegram" className="text-stone-400 hover:text-primary transition-colors">
                                <FaTelegram size={20} />
                            </a>
                            <a href="https://instagram.com/touch.memories" target="_blank" rel="noopener noreferrer"
                               aria-label="Instagram" className="text-stone-400 hover:text-primary transition-colors">
                                <FaInstagram size={20} />
                            </a>
                            <a href="https://tiktok.com/@touch.memories" target="_blank" rel="noopener noreferrer"
                               aria-label="TikTok" className="text-stone-400 hover:text-primary transition-colors">
                                <FaTiktok size={20} />
                            </a>
                        </div>
                    </div>

                    {/* Desktop Navigation Columns */}
                    {sections.map((section) => (
                        <div key={section.id} className="hidden lg:flex flex-col gap-8">
                            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/30 m-0">
                                {section.title}
                            </h4>
                            <ul className="list-none p-0 m-0 flex flex-col gap-4">
                                {section.links.map((link: any, idx: number) => (
                                    <li key={idx}>
                                        <Link href={link.href} className="text-[14px] font-medium text-primary/50 hover:text-primary hover:translate-x-1 inline-block transition-all no-underline">
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
                                                        <Link href={link.href} className="text-[14px] font-medium text-primary/60">{link.label}</Link>
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
                    <NewsletterFormFooter />
                </div>

                {/* Bottom Bar */}
                <div className="mt-32 pt-16 border-t border-primary/5 flex flex-col md:flex-row justify-between items-center gap-10">
                    <p className="text-[13px] text-primary/20 font-medium tracking-tight m-0">
                        © {new Date().getFullYear()} {content['footer_copyright'] || 'Touch.Memories'}. {t('footer.rights')}
                    </p>
                    <div className="flex gap-12">
                        {[
                            { label: 'Політика конфіденційності', href: '/privacy-policy' },
                            { label: 'Публічна оферта', href: '/public-offer' }
                        ].map((link) => (
                            <Link key={link.label} href={link.href} className="text-[13px] text-primary/20 hover:text-primary transition-colors font-medium no-underline">
                                {link.label}
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
