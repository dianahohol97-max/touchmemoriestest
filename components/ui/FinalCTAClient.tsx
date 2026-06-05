'use client';
import { useT } from '@/lib/i18n/context';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import GuestBookConfigModal from '../GuestBookConfigModal';

const GRADIENTS = [
    'from-[#1e2d7d] to-[#3a4db0]',
    'from-[#3a4db0] to-[#6b7cc9]',
    'from-[#6b7cc9] to-[#aab4e0]',
    'from-[#aab4e0] to-[#d6dcf2]',
    'from-[#d6dcf2] to-[#aab4e0]',
    'from-[#aab4e0] to-[#6b7cc9]',
    'from-[#6b7cc9] to-[#3a4db0]',
    'from-[#3a4db0] to-[#1e2d7d]',
    'from-[#1e2d7d] to-[#6b7cc9]',
];

export function FinalCTAClient({ tiles }: { tiles?: string[] }) {
    const t = useT();
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

    return (
        <section ref={ref} className="bg-[#f0f2f8] py-24 overflow-hidden relative">

            <div className="container mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center max-w-7xl mx-auto">
                    {/* Left Side: Text Content */}
                    <motion.div
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                        {/* Main Heading */}
                        <h2 className="text-[#1e2d7d] font-bold text-3xl lg:text-4xl leading-tight mb-6">
                            {t('final_cta.guestbook_cta')}
                        </h2>

                        {/* Subtext */}
                        <p className="text-lg text-gray-700 leading-relaxed mb-10">
                            {t('ui.final_cta_body')}</p>

                        {/* Buttons */}
                        <div className="flex gap-3 flex-wrap">
                            <button
                                onClick={() => setIsConfigModalOpen(true)}
                                className="flex-1 bg-[#1e2d7d] text-white text-center px-6 py-3 rounded-full font-semibold hover:bg-[#263a99] transition-colors duration-200"
                            >
                                {t('final_cta.order_designer')}
                            </button>
                            <Link
                                href="/order/book?product=wishbook"
                                className="flex-1 border-2 border-[#1e2d7d] text-[#1e2d7d] bg-white hover:bg-[#f0f2f8] font-semibold px-6 py-3 rounded-xl transition-colors text-center"
                            >
                                {t('final_cta.open_constructor')}
                            </Link>
                        </div>
                    </motion.div>

                    {/* Right Side: 3x3 Photo Grid (admin-editable; gradient where no photo) */}
                    <motion.div
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 }}
                        className="relative"
                    >
                        <div className="grid grid-cols-3 gap-3">
                            {Array.from({ length: 9 }).map((_, i) => {
                                const url = tiles?.[i];
                                if (url) {
                                    return (
                                        <div key={i} className="aspect-square rounded-xl overflow-hidden">
                                            <img src={url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    );
                                }
                                return (
                                    <div
                                        key={i}
                                        className={`aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`}
                                        aria-hidden="true"
                                    />
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Guest Book Configuration Modal */}
            <GuestBookConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
            />
        </section>
    );
}
