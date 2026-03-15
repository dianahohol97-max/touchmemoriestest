'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';

interface GeneralCTAProps {
    title: string;
    description: string;
    ctaText: string;
    ctaLink: string;
    variant?: 'primary' | 'subtle';
}

export function GeneralCTA({ title, description, ctaText, ctaLink, variant = 'primary' }: GeneralCTAProps) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} className="section-padding overflow-hidden">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                    className={`relative p-16 md:p-32 rounded-brand text-center ${variant === 'primary'
                            ? 'bg-primary text-white shadow-2xl'
                            : 'bg-premium-subtle border border-primary/10 shadow-[var(--shadow-premium)]'
                        }`}
                >
                    <div className="max-w-3xl mx-auto flex flex-col items-center gap-12">
                        <h2 className={`m-0 text-[32px] md:text-[56px] font-black leading-tight tracking-tight ${variant === 'primary' ? 'text-white' : 'text-primary'}`}>
                            {title}
                        </h2>
                        <p className={`text-[17px] md:text-[20px] leading-relaxed font-body opacity-80 ${variant === 'primary' ? 'text-white/80' : 'text-primary/60'}`}>
                            {description}
                        </p>
                        <Link
                            href={ctaLink}
                            className={`no-underline px-12 py-6 rounded-brand font-black uppercase tracking-[0.2em] transition-all transform hover:-translate-y-1 ${variant === 'primary'
                                    ? 'bg-white text-primary hover:shadow-2xl'
                                    : 'bg-primary text-white hover:shadow-xl'
                                }`}
                        >
                            {ctaText}
                        </Link>
                    </div>

                    {/* Subtle decorative elements */}
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary-hover/20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none" />
                </motion.div>
            </div>
        </section>
    );
}
