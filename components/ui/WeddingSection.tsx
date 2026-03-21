'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function WeddingSection() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const categories = [
        {
            subtitle: 'Підготуйте атмосферу вашого свята',
            title: 'До весілля',
            products: [
                {
                    name: 'Книга побажань',
                    image: '/images/wedding/guestbook.png',
                    href: '/catalog?category=guestbooks'
                },
                {
                    name: 'Весільна газета',
                    image: '/images/wedding/newspaper.png',
                    href: '/catalog?category=newspapers'
                }
            ]
        },
        {
            subtitle: 'Збережіть спогади про найважливіший день',
            title: 'Після весілля',
            products: [
                {
                    name: 'Весільна фотокнига',
                    image: '/images/wedding/photobook.png',
                    href: '/catalog?category=photobooks'
                },
                {
                    name: 'Весільний журнал',
                    image: '/images/wedding/magazine.png',
                    href: '/catalog?category=hlyantsevi-zhurnaly'
                }
            ]
        }
    ];

    return (
        <section ref={ref} className="section-padding bg-white overflow-hidden">
            <div className="container">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
                    {categories.map((category, catIdx) => (
                        <div key={catIdx} className="space-y-12">
                            {/* Column Header */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={inView ? { opacity: 1, y: 0 } : {}}
                                transition={{ duration: 0.8, delay: catIdx * 0.2 }}
                                className="space-y-4"
                            >
                                <span className="text-[13px] font-black uppercase tracking-[0.2em] text-primary/40 block">
                                    {category.subtitle}
                                </span>
                                <h2 className="text-[40px] lg:text-[48px] font-black text-primary leading-none tracking-tight">
                                    {category.title}
                                </h2>
                                <div className="w-16 h-1 bg-primary/10 rounded-full" />
                            </motion.div>

                            {/* Product Cards Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                {category.products.map((product, prodIdx) => (
                                    <motion.div
                                        key={prodIdx}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={inView ? { opacity: 1, scale: 1 } : {}}
                                        transition={{ duration: 0.6, delay: (catIdx * 0.2) + (prodIdx * 0.1) + 0.3 }}
                                        className="group"
                                    >
                                        <Link href={product.href} className="block space-y-6">
                                            {/* Image Container */}
                                            <div className="relative aspect-[4/5] rounded-[3px] overflow-hidden shadow-[var(--card-shadow)] bg-gray-50 group-hover:shadow-[var(--card-shadow-hover)] transition-all duration-500">
                                                <Image
                                                    src={product.image}
                                                    alt={product.name}
                                                    fill
                                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-black/0 group-hover:bg-primary/5 transition-colors duration-500" />
                                            </div>

                                            {/* Content */}
                                            <div className="space-y-4">
                                                <h3 className="text-xl font-black text-primary tracking-tight group-hover:text-primary/70 transition-colors">
                                                    {product.name}
                                                </h3>
                                                <div className="inline-flex items-center text-[11px] font-bold uppercase tracking-widest text-primary/60 group-hover:text-primary group-hover:gap-3 transition-all duration-300">
                                                    Замовити
                                                    <ArrowRight size={14} className="ml-2 transition-transform duration-300 group-hover:translate-x-1" />
                                                </div>
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
