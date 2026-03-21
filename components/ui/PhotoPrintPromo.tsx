'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Upload, Layout, Truck } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function PhotoPrintPromo() {
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const steps = [
        {
            number: '01',
            text: 'Завантаж фото',
            icon: <Upload size={24} className="text-primary" />
        },
        {
            number: '02',
            text: 'Обери формат',
            icon: <Layout size={24} className="text-primary" />
        },
        {
            number: '03',
            text: 'Оформи доставку',
            icon: <Truck size={24} className="text-primary" />
        }
    ];

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
                            Швидкий друк фото
                        </h2>

                        <div className="space-y-8 mb-12">
                            {steps.map((step, idx) => (
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
                                            {step.icon}
                                            <span className="font-black text-xl text-primary">{step.text}</span>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        <Link
                            href={content['photoprint_button_url'] || "/catalog?category=prints"}
                            className="inline-flex items-center justify-center px-10 py-5 bg-[#263a99] text-white font-bold text-lg rounded-md hover:bg-[#1a2966] transition-colors duration-200 group"
                        >
                            Замовити друк фото
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
                                    transition={{ duration: 0.6, delay: 0.1 * idx }}
                                    className={`relative aspect-square rounded-[3px] overflow-hidden shadow-sm hover:shadow-[var(--card-shadow-hover)] transition-all duration-500 group ${idx === 4 ? 'z-10 scale-105 shadow-md' : ''
                                        }`}
                                >
                                    <Image
                                        src={src}
                                        alt={`Фото колажу ${idx + 1}`}
                                        fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                </motion.div>
                            ))}
                        </div>

                        {/* Decorative Background Element */}
                        <div className="absolute -z-10 -top-10 -right-10 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                        <div className="absolute -z-10 -bottom-10 -left-10 w-64 h-64 bg-primary/5 rounded-full blur-[80px]" />
                    </div>

                </div>
            </div>
        </section>
    );
}
