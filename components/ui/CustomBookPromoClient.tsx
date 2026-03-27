'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Newspaper, Plane, Image as ImageIcon, Gift, ArrowRight } from 'lucide-react';

interface SectionContent {
    heading: string | null;
    subheading: string | null;
    body_text: string | null;
    cta_text: string | null;
    cta_url: string | null;
    metadata: any;
}

interface CustomBookPromoClientProps {
    sectionContent?: SectionContent;
}

export function CustomBookPromoClient({ sectionContent }: CustomBookPromoClientProps) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    // Use section content or fallback to defaults
    const heading = sectionContent?.heading || 'Фотокниги, журнали та фотовироби з душею';
    const subheading = sectionContent?.subheading || 'Touch.Memories — студія у Тернополі, яка перетворює ваші фотографії на красиві фізичні вироби';
    const bodyText = sectionContent?.body_text || 'Фотокниги, глянцеві журнали, тревел-буки, фотодрук та сувеніри — все з преміум якістю та турботою до деталей.';
    const ctaText = sectionContent?.cta_text || 'В магазин';
    const ctaUrl = sectionContent?.cta_url || '/catalog';

    const productCategories = [
        {
            icon: <BookOpen size={40} strokeWidth={1.5} />,
            label: 'Фотокниги',
            href: '/catalog?category=photobooks'
        },
        {
            icon: <Newspaper size={40} strokeWidth={1.5} />,
            label: 'Журнали',
            href: '/catalog?category=magazines'
        },
        {
            icon: <Plane size={40} strokeWidth={1.5} />,
            label: 'TravelBook',
            href: '/catalog/travelbook'
        },
        {
            icon: <ImageIcon size={40} strokeWidth={1.5} />,
            label: 'Фотодрук',
            href: '/catalog/photo-prints'
        },
        {
            icon: <Gift size={40} strokeWidth={1.5} />,
            label: 'Подарунки',
            href: '/catalog?category=gifts'
        }
    ];

    return (
        <section ref={ref} className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-center"
                >
                    {/* Main Heading */}
                    <h2 className="text-3xl lg:text-4xl font-black text-[#1e2d7d] leading-tight mb-6">
                        {heading}
                    </h2>

                    {/* Description */}
                    <p className="text-lg text-stone-600 leading-relaxed max-w-3xl mx-auto mb-12">
                        {subheading}
                        {bodyText && bodyText !== subheading && (
                            <> {bodyText}</>
                        )}
                    </p>

                    {/* Product Category Icons Row */}
                    <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-12 mb-12">
                        {productCategories.map((category, index) => (
                            <motion.div
                                key={category.label}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Link
                                    href={category.href}
                                    className="flex flex-col items-center gap-3 group cursor-pointer"
                                >
                                    <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-[#1e2d7d] group-hover:text-white transition-all duration-200 group-hover:scale-110">
                                        {category.icon}
                                    </div>
                                    <span className="text-sm font-semibold text-stone-700 group-hover:text-stone-900 transition-colors">
                                        {category.label}
                                    </span>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Primary CTA Button */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.6 }}
                    >
                        <Link
                            href={ctaUrl}
                            className="inline-flex items-center gap-3 bg-white text-[#1e2d7d] border border-[#1e2d7d] hover:bg-[#f0f2f8] font-semibold px-7 py-3.5 rounded-lg transition-colors duration-200"
                        >
                            {ctaText}
                            <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
