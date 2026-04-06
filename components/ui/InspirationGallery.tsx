'use client';
import { useT } from '@/lib/i18n/context';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';

const IMAGES = [
    { src: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=800', size: 'large' },
    { src: 'https://images.unsplash.com/photo-1520850838988-424653609758?q=80&w=800', size: 'small' },
    { src: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=800', size: 'medium' },
    { src: 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800', size: 'small' },
    { src: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800', size: 'medium' },
    { src: 'https://images.unsplash.com/photo-1472396961693-142e6e269027?q=80&w=800', size: 'large' },
];

export function InspirationGallery() {
    const t = useT();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    return (
        <section ref={ref} className="section-padding bg-white">
            <div className="container">
                <div className="mb-24 text-center">
                    <h2 className="section-title">{t('inspiration.gallery_title')}</h2>
                    <p className="section-subtitle">{t('inspiration.gallery_subtitle')}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:auto-rows-[250px]">
                    {IMAGES.map((img, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.8, delay: idx * 0.1 }}
                            className={`relative overflow-hidden rounded-brand shadow-[var(--shadow-subtle)] hover:shadow-[var(--shadow-premium)] transition-all cursor-pointer ${img.size === 'large' ? 'md:row-span-2 md:col-span-2' :
                                    img.size === 'medium' ? 'md:row-span-2' : ''
                                }`}
                        >
                            <Image
                                src={img.src}
                                alt="Inspiration"
                                fill
                                className="object-cover transition-transform duration-1000 hover:scale-110"
                            />
                        </motion.div>
                    ))}
                </div>

                <div className="mt-20 text-center">
                    <button className="btn-secondary group">
                        {t('inspiration.view_instagram')}
                        <span className="ml-3 group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                </div>
            </div>
        </section>
    );
}
