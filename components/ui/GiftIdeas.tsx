'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import Link from 'next/link';

export function GiftIdeas() {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const buttons = [
        { label: 'для неї', slug: 'for-her' },
        { label: 'для нього', slug: 'for-him' },
        { label: 'для мами', slug: 'for-mom' },
        { label: 'для бабусі', slug: 'for-grandma' },
        { label: 'для тата', slug: 'for-dad' },
        { label: 'для дідуся', slug: 'for-grandpa' },
        { label: 'для подруги', slug: 'for-friend' },
        { label: 'для боса', slug: 'for-boss' },
        { label: 'для пари', slug: 'for-couple' },
    ];

    return (
        <section ref={ref} className="relative w-full min-h-[600px] flex items-center justify-center overflow-hidden py-24">
            {/* Background Image */}
            <Image
                src="/images/promo/gift_ideas_bg.png"
                alt="Ідеї для подарунків"
                fill
                className="object-cover"
                priority
            />
            {/* Dark Overlay for better contrast */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" />

            <div className="container relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    className="text-center mb-16"
                >
                    <h2 className="text-[40px] lg:text-[64px] font-black leading-none tracking-tight text-white drop-shadow-lg mb-4">
                        Ідеї для подарунків
                    </h2>
                    <p className="text-white/90 text-lg lg:text-xl font-medium max-w-2xl mx-auto drop-shadow-md">
                        Підібрані колекції для найважливіших людей у вашому житті
                    </p>
                </motion.div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-8 max-w-4xl mx-auto">
                    {buttons.map((btn, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={inView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ duration: 0.5, delay: idx * 0.05 + 0.3 }}
                        >
                            <Link
                                href={`/catalog?collection=${btn.slug}`}
                                className="group relative flex items-center justify-center p-6 lg:p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-[12px] text-white font-bold text-lg lg:text-xl uppercase tracking-widest transition-all duration-500 hover:bg-white/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] hover:-translate-y-1 text-center"
                            >
                                <span className="relative z-10 transition-transform duration-500 group-hover:scale-110">
                                    {btn.label}
                                </span>
                            </Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
