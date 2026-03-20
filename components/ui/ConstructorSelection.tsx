'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { goToConstructor, ProductType } from '@/lib/constructorRouting';

export function ConstructorSelection() {
    const router = useRouter();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const items = [
        {
            title: 'Фотокниги',
            videoThumb: '/images/promo/photobook_video.png',
            buttonText: 'Створити фотокнигу',
            productType: 'photobook' as ProductType,
            description: 'Фотографiя, яка оживає'
        },
        {
            title: 'Глянцеві журнали',
            videoThumb: '/images/promo/magazine_video.png',
            buttonText: 'Створити журнал',
            productType: 'magazine' as ProductType,
            description: 'Твій стиль, твоя iсторiя'
        }
    ];

    const handleCreateClick = (productType: ProductType) => {
        const url = goToConstructor({ productType });
        router.push(url);
    };

    return (
        <section ref={ref} className="section-padding bg-white">
            <div className="container">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
                    {items.map((item, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 30 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.8, delay: idx * 0.2, ease: [0.23, 1, 0.32, 1] }}
                            className="flex flex-col group"
                        >
                            {/* Video Container */}
                            <div className="relative aspect-[16/10] rounded-[3px] overflow-hidden shadow-[var(--card-shadow)] border border-gray-100 mb-8 bg-gray-50 flex items-center justify-center group-hover:shadow-[var(--card-shadow-hover)] transition-all duration-700">
                                <Image
                                    src={item.videoThumb}
                                    alt={item.title}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                {/* Play Icon Overlay */}
                                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-100 group-hover:bg-black/20 transition-all duration-500">
                                    <div className="w-16 h-16 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl scale-100 group-hover:scale-110 transition-transform duration-500">
                                        <Play size={24} className="text-primary ml-1 fill-primary" />
                                    </div>
                                </div>
                            </div>

                            {/* Product Description */}
                            <div className="w-full mb-8">
                                <h3 className="text-2xl lg:text-3xl font-black text-primary mb-3 tracking-tight">
                                    {item.title}
                                </h3>
                                <p className="text-base text-primary/60 font-body leading-relaxed">
                                    {item.description}
                                </p>
                            </div>

                            {/* CTA Button */}
                            <div className="flex justify-center lg:justify-start">
                                <button
                                    onClick={() => handleCreateClick(item.productType)}
                                    className="btn-primary min-w-[200px] text-center"
                                >
                                    {item.buttonText}
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
