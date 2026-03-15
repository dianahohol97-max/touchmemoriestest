'use client';
import { useState } from 'react';
import styles from './ProductGallery.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

export function ProductGallery({ images }: { images: string[] }) {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isZoomed, setIsZoomed] = useState(false);

    const nextImage = () => setActiveIndex((prev) => (prev + 1) % images.length);
    const prevImage = () => setActiveIndex((prev) => (prev - 1 + images.length) % images.length);

    if (!images.length) return <div style={{ aspectRatio: '1/1', background: '#f9f9f9', borderRadius: "3px" }}></div>;

    return (
        <div className={styles.galleryContainer} style={{ position: 'sticky', top: '120px', height: 'fit-content' }}>

            {/* Main Image Container */}
            <div style={{
                position: 'relative',
                aspectRatio: '1/1',
                borderRadius: "3px",
                overflow: 'hidden',
                backgroundColor: '#f9f9f9',
                boxShadow: '0 10px 40px rgba(0,0,0,0.05)',
                marginBottom: '24px',
                cursor: 'zoom-in'
            }} onClick={() => setIsZoomed(true)}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{ width: '100%', height: '100%' }}
                    >
                        <Image
                            src={images[activeIndex]}
                            alt={`Product image ${activeIndex + 1}`}
                            fill
                            sizes="(max-width: 768px) 100vw, 600px"
                            style={{ objectFit: 'cover' }}
                            priority
                        />
                    </motion.div>
                </AnimatePresence>

                <button
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    style={arrowBtnStyle}
                    className={styles.galleryArrow}
                >
                    <ChevronLeft size={24} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    style={{ ...arrowBtnStyle, right: '20px', left: 'auto' }}
                    className={styles.galleryArrow}
                >
                    <ChevronRight size={24} />
                </button>

                <div style={{ position: 'absolute', top: '20px', right: '20px', padding: '10px', backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(4px)', borderRadius: "3px", color: '#333' }}>
                    <Maximize2 size={18} />
                </div>
            </div>

            {/* Thumbnails */}
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }} className={styles.noScrollbar}>
                {images.map((img, idx) => (
                    <button
                        key={idx}
                        onClick={() => setActiveIndex(idx)}
                        style={{
                            position: 'relative',
                            width: '80px',
                            height: '80px',
                            borderRadius: "3px",
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: activeIndex === idx ? '2px solid var(--primary)' : '2px solid transparent',
                            padding: 0,
                            cursor: 'pointer',
                            backgroundColor: '#f9f9f9'
                        }}
                    >
                        <Image
                            src={img}
                            alt={`Thumbnail ${idx + 1}`}
                            fill
                            sizes="80px"
                            style={{ objectFit: 'cover' }}
                        />
                    </button>
                ))}
            </div>

        </div>
    );
}

const arrowBtnStyle = {
    position: 'absolute' as const,
    top: '50%',
    left: '20px',
    transform: 'translateY(-50%)',
    width: '48px',
    height: '48px',
    borderRadius: "3px",
    backgroundColor: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(4px)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#333',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    zIndex: 10
};
