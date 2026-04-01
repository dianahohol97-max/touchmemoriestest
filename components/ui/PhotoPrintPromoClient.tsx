'use client';
import { useT } from '@/lib/i18n/context';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Upload, Layout, Truck } from 'lucide-react';

interface SectionContent {
    heading: string | null;
    subheading: string | null;
    body_text: string | null;
    cta_text: string | null;
    cta_url: string | null;
    metadata: any;
}

interface PhotoPrintPromoClientProps {
    sectionContent?: SectionContent;
}

export function PhotoPrintPromoClient({
  const t = useT(); sectionContent }: PhotoPrintPromoClientProps) {
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    // Use section content or fallback to defaults
    const heading = sectionContent?.heading || 'Швидкий друк фото';
    const ctaText = sectionContent?.cta_text || 'Замовити друк фото';
    const ctaUrl = sectionContent?.cta_url || '/catalog?category=prints';

    // Get steps from metadata or use defaults
    const defaultSteps = [
        {
            number: '1',
            title: 'Оберіть формат',
            description: 'Стандартний, нестандартний, Polaroid — вибери розмір, який підходить вам.',
            icon: <Layout size={24} className="text-primary" />
        },
        {
            number: '2',
            title: 'Завантажте фото',
            description: 'Надішли нам фотографії у зручний спосіб — через Telegram, Instagram або на email.',
            icon: <Upload size={24} className="text-primary" />
        },
        {
            number: '3',
            title: 'Оформіть замовлення',
            description: 'Ми підтвердимо деталі та надішлемо готові фото у зазначені терміни.',
            icon: <Truck size={24} className="text-primary" />
        }
    ];

    const steps = sectionContent?.metadata?.steps || defaultSteps;

    const collageImages = [
        '/images/collage/1.png',
        '/images/collage/2.png',
        '/images/collage/3.png',
        '/images/collage/4.png',
        '/images/collage/5.png',
        '/images/collage/6.png',
        '/images/collage/7.png',
        '/images/collage/8.png',
        '/images/collage/9.png',
    ];

    return (
        <section ref={ref} className="section-padding bg-white overflow-hidden">
            <div className="container">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">

                    {/* Left Side: Content & Steps */}
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                    >
                        <h2 className="text-[40px] lg:text-[56px] font-black text-primary leading-none tracking-tight mb-12">
                            {heading}
                        </h2>

                        <div className="space-y-8 mb-12">
                            {steps.map((step: any, idx: number) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ duration: 0.5, delay: 0.3 + (idx * 0.1) }}
                                    className="flex items-center gap-6 group"
                                >
                                    <div className="flex-shrink-0 w-16 h-16 rounded-full bg-primary/5 flex items-center justify-center font-black text-2xl text-primary/50 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                        {step.number}
                                    </div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2 mb-1">
                                            {step.icon || (idx === 0 ? <Layout size={24} className="text-primary" /> : idx === 1 ? <Upload size={24} className="text-primary" /> : <Truck size={24} className="text-primary" />)}
                                            <span className="font-black text-xl text-primary">{step.title}</span>
                                        </div>
                                        <p className="text-stone-600 text-sm leading-relaxed">{step.description}</p>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <Link
                            href={ctaUrl}
                            className="inline-flex items-center justify-center px-10 py-5 bg-[#1e2d7d] text-white font-bold text-lg rounded-md hover:bg-[#152158] transition-colors duration-200 group"
                        >
                            {ctaText}
                            <ArrowRight size={20} className="ml-3 transition-transform duration-300 group-hover:translate-x-1" />
                        </Link>
                    </motion.div>

                    {/* Right Side: 9-Photo Collage Grid */}
                    <div className="relative">
                        <div className="grid grid-cols-3 gap-3">
                            {collageImages.map((src, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                                    transition={{ duration: 0.5, delay: 0.5 + (idx * 0.05) }}
                                    className="aspect-square rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300"
                                >
                                    <Image
                                        src={src}
                                        alt={`Photo ${idx + 1}`}
                                        width={200}
                                        height={200}
                                        className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                                    />
                                </motion.div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
