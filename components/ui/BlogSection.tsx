'use client';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

interface BlogPost {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    cover_image: string;
    cover_image_alt: string;
    reading_time: number;
    published_at: string;
    category?: {
        name: string;
        slug: string;
    };
}

interface BlogSectionProps {
    posts?: BlogPost[];
}

export function BlogSection({ posts = [] }: BlogSectionProps) {
    const { content } = useTheme();
    const { ref, inView } = useInView({
        triggerOnce: true,
        threshold: 0.1,
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('uk-UA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <section ref={ref} style={{ padding: '60px 0', backgroundColor: 'white' }}>
            <div className="container">
                {/* Section Header */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={inView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.6 }}
                    style={{ textAlign: 'center', marginBottom: '60px' }}
                >
                    <h2 style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: '48px',
                        fontWeight: 900,
                        marginBottom: '16px'
                    }}>
                        {content['blog_title'] || 'Блог'}
                    </h2>
                    <p style={{ fontSize: '18px', color: '#666', maxWidth: '600px', margin: '0 auto' }}>
                        {content['blog_subtitle'] || 'Натхнення, ідеї та поради від команди Touch Memories'}
                    </p>
                </motion.div>

                {/* Blog Posts Grid */}
                {posts.length > 0 ? (
                    <>
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                            gap: '32px',
                            marginBottom: '60px'
                        }}>
                            {posts.map((post, index) => (
                                <motion.div
                                    key={post.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={inView ? { opacity: 1, y: 0 } : {}}
                                    transition={{ duration: 0.6, delay: index * 0.1 }}
                                >
                                    <Link
                                        href={`/blog/${post.slug}`}
                                        style={{
                                            textDecoration: 'none',
                                            color: 'inherit',
                                            backgroundColor: 'white',
                                            borderRadius: '16px',
                                            overflow: 'hidden',
                                            border: '1px solid #e0e0e0',
                                            transition: 'transform 0.3s, box-shadow 0.3s',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                        className="hover-lift"
                                    >
                                        {/* Cover Image */}
                                        <div style={{
                                            position: 'relative',
                                            width: '100%',
                                            height: '240px',
                                            backgroundColor: '#e0e0e0',
                                            overflow: 'hidden'
                                        }}>
                                            {post.cover_image ? (
                                                <Image
                                                    src={post.cover_image}
                                                    alt={post.cover_image_alt || post.title}
                                                    fill
                                                    style={{ objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <div style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    backgroundColor: '#e0e0e0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '14px',
                                                    color: '#999'
                                                }}>
                                                    Зображення відсутнє
                                                </div>
                                            )}
                                            {post.category && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '16px',
                                                    left: '16px',
                                                    backgroundColor: 'var(--primary)',
                                                    color: 'white',
                                                    padding: '6px 12px',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {post.category.name}
                                                </div>
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                            <h3 style={{
                                                fontFamily: 'var(--font-heading)',
                                                fontSize: '22px',
                                                fontWeight: 700,
                                                marginBottom: '12px',
                                                lineHeight: 1.3,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {post.title}
                                            </h3>

                                            <p style={{
                                                color: '#666',
                                                lineHeight: 1.6,
                                                marginBottom: '16px',
                                                flex: 1,
                                                display: '-webkit-box',
                                                WebkitLineClamp: 3,
                                                WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>
                                                {post.excerpt}
                                            </p>

                                            {/* Meta Info */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                fontSize: '14px',
                                                color: '#999',
                                                paddingTop: '16px',
                                                borderTop: '1px solid #e0e0e0'
                                            }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Calendar size={14} />
                                                    {formatDate(post.published_at)}
                                                </span>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Clock size={14} />
                                                    {post.reading_time} хв
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>

                        {/* Read All Articles Button */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.6, delay: 0.7 }}
                            style={{ textAlign: 'center' }}
                        >
                            <Link
                                href="/blog"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '16px 32px',
                                    backgroundColor: 'white',
                                    color: 'var(--primary)',
                                    fontSize: '16px',
                                    fontWeight: 700,
                                    borderRadius: '12px',
                                    textDecoration: 'none',
                                    border: '2px solid var(--primary)',
                                    transition: 'all 0.3s',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'var(--primary)';
                                    e.currentTarget.style.color = 'white';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'white';
                                    e.currentTarget.style.color = 'var(--primary)';
                                }}
                            >
                                Читати всі статті
                                <ArrowRight size={20} />
                            </Link>
                        </motion.div>
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={inView ? { opacity: 1 } : {}}
                        transition={{ duration: 0.6 }}
                        style={{
                            textAlign: 'center',
                            padding: '60px 20px',
                            backgroundColor: '#f8f9fa',
                            borderRadius: '16px'
                        }}
                    >
                        <p style={{ fontSize: '18px', color: '#999' }}>
                            Скоро тут з'являться цікаві статті
                        </p>
                    </motion.div>
                )}
            </div>
        </section>
    );
}
