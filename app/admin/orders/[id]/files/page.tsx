'use client';
import { useState, useEffect, use } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Download,
    Trash2,
    Loader2,
    Image as ImageIcon,
    FileText,
    Archive,
    ExternalLink,
    AlertCircle,
    CheckCircle2,
    User
} from 'lucide-react';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface OrderFile {
    id: string;
    order_id: string;
    file_path: string;
    file_name: string;
    file_type: 'upload' | 'export';
    file_category?: string;
    bucket_name: string;
    page_number?: number;
    file_size?: number;
    mime_type?: string;
    product_type?: string;
    created_at: string;
}

export default function OrderFilesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const supabase = createClient();
    const router = useRouter();

    const [order, setOrder] = useState<any>(null);
    const [files, setFiles] = useState<OrderFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        fetchOrderAndFiles();
    }, [id]);

    const fetchOrderAndFiles = async () => {
        setLoading(true);

        // Fetch order details
        const { data: orderData } = await supabase
            .from('orders')
            .select('*')
            .eq('id', id)
            .single();

        if (orderData) setOrder(orderData);

        // Fetch order files
        const { data: filesData, error } = await supabase
            .from('order_files')
            .select('*')
            .eq('order_id', id)
            .order('created_at', { ascending: false });

        if (filesData) setFiles(filesData);
        if (error) console.error('Error fetching files:', error);

        // Storage buckets holding customer content are private — generate
        // short-lived signed URLs per bucket for previews (getPublicUrl no
        // longer works once the bucket is private).
        if (filesData && filesData.length) {
            const byBucket: Record<string, OrderFile[]> = {};
            for (const f of filesData) (byBucket[f.bucket_name || 'order-files'] ||= []).push(f);
            const map: Record<string, string> = {};
            await Promise.all(Object.entries(byBucket).map(async ([bucket, list]) => {
                try {
                    const { data: signed } = await supabase.storage.from(bucket)
                        .createSignedUrls(list.map(f => f.file_path), 60 * 60);
                    (signed || []).forEach((s, i) => { if (s?.signedUrl) map[list[i].id] = s.signedUrl; });
                } catch (e) { console.error('sign error', bucket, e); }
            }));
            setSignedUrls(map);
        }

        setLoading(false);
    };

    const downloadFile = async (file: OrderFile) => {
        try {
            const { data, error } = await supabase.storage
                .from(file.bucket_name)
                .download(file.file_path);

            if (error) throw error;

            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.file_name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast.success(`Файл "${file.file_name}" завантажено`);
        } catch (error: any) {
            console.error('Download error:', error);
            toast.error('Помилка завантаження файлу');
        }
    };

    const downloadAllAsZip = async () => {
        if (files.length === 0) {
            toast.error('Немає файлів для завантаження');
            return;
        }

        setDownloadingAll(true);
        const zip = new JSZip();

        try {
            // Download all files in parallel
            const downloadPromises = files.map(async (file) => {
                try {
                    const { data, error } = await supabase.storage
                        .from(file.bucket_name)
                        .download(file.file_path);

                    if (error) throw error;

                    // Add file to zip with folder structure
                    const folderName = file.file_type === 'upload' ? 'uploads' : 'exports';
                    zip.file(`${folderName}/${file.file_name}`, data);
                } catch (err) {
                    console.error(`Failed to download ${file.file_name}:`, err);
                }
            });

            await Promise.all(downloadPromises);

            // Generate ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `order-${order?.order_number || id}-files.zip`);

            toast.success('Всі файли завантажено в ZIP');
        } catch (error: any) {
            console.error('ZIP creation error:', error);
            toast.error('Помилка створення ZIP архіву');
        } finally {
            setDownloadingAll(false);
        }
    };

    const deleteFile = async (file: OrderFile) => {
        if (!confirm(`Видалити файл "${file.file_name}"?`)) return;

        setDeletingFileId(file.id);

        try {
            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from(file.bucket_name)
                .remove([file.file_path]);

            if (storageError) throw storageError;

            // Delete from database
            const { error: dbError } = await supabase
                .from('order_files')
                .delete()
                .eq('id', file.id);

            if (dbError) throw dbError;

            toast.success('Файл видалено');
            fetchOrderAndFiles();
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error('Помилка видалення файлу');
        } finally {
            setDeletingFileId(null);
        }
    };

    const getFileUrl = (file: OrderFile) => {
        return signedUrls[file.id] || '';
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '—';
        const mb = bytes / (1024 * 1024);
        if (mb >= 1) return `${mb.toFixed(2)} MB`;
        const kb = bytes / 1024;
        return `${kb.toFixed(2)} KB`;
    };

    const isImageFile = (mimeType?: string) => {
        return mimeType?.startsWith('image/');
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                <Loader2 className="animate-spin" size={48} color="#cbd5e1" />
            </div>
        );
    }

    const uploadFiles = files.filter(f => f.file_type === 'upload');
    const exportFiles = files.filter(f => f.file_type === 'export');

    return (
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px', color: '#263A99' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <button onClick={() => router.back()} style={iconButtonStyle}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'var(--font-heading)', margin: 0 }}>
                            Файли замовлення {order?.order_number}
                        </h1>
                        <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                            Всього файлів: {files.length} ({uploadFiles.length} завантажених + {exportFiles.length} експортованих)
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <Link
                        href={`/admin/orders/${id}`}
                        style={{
                            padding: '12px 24px',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '3px',
                            backgroundColor: 'white',
                            color: '#64748b',
                            textDecoration: 'none',
                            fontSize: '14px',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <ExternalLink size={16} /> Переглянути замовлення
                    </Link>
                    <button
                        onClick={downloadAllAsZip}
                        disabled={downloadingAll || files.length === 0}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: downloadingAll ? '#cbd5e1' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: downloadingAll || files.length === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        {downloadingAll ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                Створення ZIP...
                            </>
                        ) : (
                            <>
                                <Archive size={16} />
                                Завантажити всі як ZIP
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Client contacts + questionnaire — everything a designer working
                in an external tool needs in one place, above the files. */}
            {order && (() => {
                const items = (order.items || []) as any[];
                const ig = (order.customer_instagram || '').replace('@', '');
                const tg = (order.customer_telegram || '').replace('@', '');
                const contactRow = (label: string, value: any, href?: string) => value ? (
                    <div style={{ display: 'flex', gap: 8, fontSize: 14, marginBottom: 6 }}>
                        <span style={{ color: '#94a3b8', minWidth: 90, fontWeight: 600 }}>{label}</span>
                        {href
                            ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#263A99', fontWeight: 600, textDecoration: 'none' }}>{value}</a>
                            : <span style={{ color: '#374151', fontWeight: 600 }}>{value}</span>}
                    </div>
                ) : null;
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 40 }}>
                        {/* Contacts */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
                            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <User size={18} /> Контакти клієнта
                            </h2>
                            {contactRow('Імʼя', order.customer_name)}
                            {contactRow('Телефон', order.customer_phone, order.customer_phone ? `tel:${order.customer_phone}` : undefined)}
                            {contactRow('Email', order.customer_email, order.customer_email ? `mailto:${order.customer_email}` : undefined)}
                            {contactRow('Instagram', ig ? `@${ig}` : null, ig ? `https://instagram.com/${ig}` : undefined)}
                            {contactRow('Telegram', tg ? `@${tg}` : null, tg ? `https://t.me/${tg}` : undefined)}
                        </div>

                        {/* Questionnaire / options per item */}
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '20px 24px' }}>
                            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1e2d7d', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <FileText size={18} /> Анкета та параметри
                            </h2>
                            {items.map((it: any, idx: number) => {
                                const opts = it.options && typeof it.options === 'object' ? it.options : {};
                                const entries = Object.entries(opts).filter(([, v]) => v != null && String(v).trim() !== '');
                                return (
                                    <div key={idx} style={{ marginBottom: idx < items.length - 1 ? 16 : 0 }}>
                                        <div style={{ fontWeight: 700, color: '#374151', fontSize: 14, marginBottom: 8 }}>{it.name || it.product_name || 'Товар'}</div>
                                        {it.personalization_note && (
                                            <div style={{ fontSize: 13, color: '#475569', background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{it.personalization_note}</div>
                                        )}
                                        {entries.length > 0 ? (
                                            <div style={{ display: 'grid', gap: 4 }}>
                                                {entries.map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                                                        <span style={{ color: '#94a3b8', fontWeight: 600, minWidth: 130 }}>{k}</span>
                                                        <span style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>{String(v)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 13, color: '#94a3b8' }}>Параметрів не вказано</div>
                                        )}
                                    </div>
                                );
                            })}
                            {order.comment && (
                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Коментар клієнта</div>
                                    <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{order.comment}</div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Empty State */}
            {files.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '80px 20px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '3px',
                    border: '1px dashed #cbd5e1'
                }}>
                    <AlertCircle size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>
                        Немає файлів
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>
                        Файли з'являться тут після завантаження клієнтом або експорту системою
                    </p>
                </div>
            )}

            {/* Uploaded Files Section */}
            {uploadFiles.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={sectionHeaderStyle}>
                        <h2 style={sectionTitleStyle}>
                            <ImageIcon size={20} /> Завантажені фото ({uploadFiles.length})
                        </h2>
                    </div>

                    <div style={thumbnailGridStyle}>
                        {uploadFiles.map(file => (
                            <div key={file.id} style={thumbnailCardStyle}>
                                {isImageFile(file.mime_type) ? (
                                    <div style={thumbnailImageContainerStyle}>
                                        <img
                                            src={getFileUrl(file)}
                                            alt={file.file_name}
                                            style={thumbnailImageStyle}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ ...thumbnailImageContainerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                                        <FileText size={40} color="#cbd5e1" />
                                    </div>
                                )}

                                <div style={thumbnailInfoStyle}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#263A99', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.file_name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: file.product_type ? '4px' : '8px' }}>
                                        {formatFileSize(file.file_size)}
                                        {file.page_number && ` • Сторінка ${file.page_number}`}
                                    </div>
                                    {file.product_type && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#eff6ff', color: '#263A99', padding: '2px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                                                {{ photobook:'Фотокнига', photoprint:'Фотодрук', journal:'Журнал', poster:'Постер', calendar:'Календар', travelbook:'Travel Book', photomagnets:'Магніти', puzzle:'Пазл', 'star-map':'Карта зір', wishbook:'Книга побажань', planner:'Планер', 'wall-calendar':'Настінний календар', 'desk-calendar':'Настільний календар', 'canvas-print':'Друк на полотні', citymap:'Карта міста', lovemap:'Карта кохання', monogram:'Монограма', zodiac:'Знак зодіаку', 'birth-stats':'Метрика новонародженого', 'cartoon-portrait':'Портрет', 'designer-brief':'Дизайнерський бриф' }[file.product_type] || file.product_type}
                                            </span>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => downloadFile(file)}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                backgroundColor: '#eff6ff',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: '#263A99',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Download size={12} /> Завантажити
                                        </button>
                                        <button
                                            onClick={() => deleteFile(file)}
                                            disabled={deletingFileId === file.id}
                                            style={{
                                                padding: '6px 10px',
                                                backgroundColor: '#fef2f2',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: '#ef4444',
                                                cursor: deletingFileId === file.id ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {deletingFileId === file.id ? (
                                                <Loader2 className="animate-spin" size={12} />
                                            ) : (
                                                <Trash2 size={12} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Exported Files Section */}
            {exportFiles.length > 0 && (
                <div>
                    <div style={sectionHeaderStyle}>
                        <h2 style={sectionTitleStyle}>
                            <CheckCircle2 size={20} /> Експортовані файли для друку ({exportFiles.length})
                        </h2>
                    </div>

                    <div style={thumbnailGridStyle}>
                        {exportFiles.map(file => (
                            <div key={file.id} style={thumbnailCardStyle}>
                                {isImageFile(file.mime_type) ? (
                                    <div style={thumbnailImageContainerStyle}>
                                        <img
                                            src={getFileUrl(file)}
                                            alt={file.file_name}
                                            style={thumbnailImageStyle}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ ...thumbnailImageContainerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                                        <FileText size={40} color="#cbd5e1" />
                                    </div>
                                )}

                                <div style={thumbnailInfoStyle}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#263A99', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file.file_name}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                                        {formatFileSize(file.file_size)}
                                        {file.page_number && ` • Сторінка ${file.page_number}`}
                                    </div>
                                    {file.file_category && (
                                        <div style={{
                                            fontSize: '10px',
                                            fontWeight: 700,
                                            color: '#10b981',
                                            backgroundColor: '#f0fdf4',
                                            padding: '3px 8px',
                                            borderRadius: '3px',
                                            marginBottom: '8px',
                                            textTransform: 'uppercase'
                                        }}>
                                            {file.file_category}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button
                                            onClick={() => downloadFile(file)}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                backgroundColor: '#f0fdf4',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: '#10b981',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            <Download size={12} /> Завантажити
                                        </button>
                                        <button
                                            onClick={() => deleteFile(file)}
                                            disabled={deletingFileId === file.id}
                                            style={{
                                                padding: '6px 10px',
                                                backgroundColor: '#fef2f2',
                                                border: 'none',
                                                borderRadius: '3px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: '#ef4444',
                                                cursor: deletingFileId === file.id ? 'wait' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}
                                        >
                                            {deletingFileId === file.id ? (
                                                <Loader2 className="animate-spin" size={12} />
                                            ) : (
                                                <Trash2 size={12} />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Styles
const iconButtonStyle = {
    width: '44px',
    height: '44px',
    borderRadius: '3px',
    border: '1.5px solid #e2e8f0',
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#64748b'
};

const sectionHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
};

const sectionTitleStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '20px',
    fontWeight: 900,
    margin: 0,
    color: '#263A99'
};

const thumbnailGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px'
};

const thumbnailCardStyle = {
    backgroundColor: 'white',
    border: '1px solid #f1f5f9',
    borderRadius: '3px',
    overflow: 'hidden',
    boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
};

const thumbnailImageContainerStyle = {
    width: '100%',
    height: '200px',
    overflow: 'hidden',
    backgroundColor: '#f8fafc'
};

const thumbnailImageStyle = {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as any
};

const thumbnailInfoStyle = {
    padding: '12px'
};
