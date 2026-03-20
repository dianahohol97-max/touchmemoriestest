'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import { BookOpen, Newspaper, Plane, Image as ImageIcon, Gift, ArrowRight } from 'lucide-react';

export function CustomBookPromo() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.2,
    });

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
                    {/* Label */}
                    <p className="text-xs text-stone-500 tracking-widest uppercase mb-4">
                        НАШІ ПРОДУКТИ
                    </p>

                    {/* Main Heading */}
                    <h2 className="text-3xl lg:text-4xl font-black text-stone-900 leading-tight mb-6">
                        Фотокниги, журнали та фотовироби з душею
                    </h2>

                    {/* Description */}
                    <p className="text-lg text-stone-600 leading-relaxed max-w-3xl mx-auto mb-12">
                        Touch.Memories — студія у Тернополі, яка перетворює твої фотографії на красиві
                        фізичні вироби. Фотокниги, глянцеві журнали, тревел-буки, фотодрук та сувеніри —
                        все з преміум якістю та турботою до деталей.
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
                                    <div className="w-20 h-20 rounded-full bg-stone-100 flex items-center justify-center text-stone-700 group-hover:bg-stone-900 group-hover:text-white transition-all duration-300 group-hover:scale-110">
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
                            href="/catalog"
                            className="inline-flex items-center gap-3 bg-[#1e3a8a] text-white px-10 py-4 rounded-full text-lg font-bold hover:bg-[#1e40af] transition-all duration-300 hover:shadow-xl hover:scale-105"
                        >
                            В магазин
                            <ArrowRight size={20} />
                        </Link>
                    </motion.div>
                </motion.div>
            </div>
        </section>
    );
}
