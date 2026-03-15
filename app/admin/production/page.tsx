'use client';
import { useState, useEffect, useMemo } from 'react';
import styles from './production.module.css';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { formatUKDate, addWorkingDays, getDeadlineStatus } from '@/lib/date-utils';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
    Loader2, Download, ChevronRight, ChevronLeft,
    Calendar, User, Box, FileText, CheckSquare, Square
} from 'lucide-react';

const COLUMNS = [
    { id: 'confirmed', title: 'Очікує друку' },
    { id: 'in_production', title: 'У друці' },
    { id: 'shipped', title: 'Готово до відпр.' },
    { id: 'delivered', title: 'Відправлено' },
];

export default function ProductionKanbanPage() {
    const supabase = createClient();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [downloading, setDownloading] = useState(false);
    const [deadlineFilter, setDeadlineFilter] = useState('all'); // 'all', 'today', 'tomorrow', 'this_week'

    useEffect(() => {
        fetchOrders();

        // Subscribe to real-time changes
        const subscription = supabase.channel('production_orders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
                fetchOrders(); // Re-fetch or update locally
            })
            .subscribe();

        return () => { supabase.removeChannel(subscription); }
    }, []);

    const fetchOrders = async () => {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                manager:staff!orders_manager_id_fkey(id, name, initials, color),
                designer:staff!orders_designer_id_fkey(id, name, initials, color),
                order_tag_assignments(order_tags(*))
            `)
            .in('order_status', ['confirmed', 'in_production', 'shipped', 'delivered'])
            .order('created_at', { ascending: false });

        if (!error && data) {
            setOrders(data);
        }
        setLoading(false);
    };

    const handleStatusMove = async (orderId: string, currentStatus: string, direction: 'next' | 'prev') => {
        const currentIndex = COLUMNS.findIndex(c => c.id === currentStatus);
        const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

        if (newIndex < 0 || newIndex >= COLUMNS.length) return;
        const newStatus = COLUMNS[newIndex].id;

        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: newStatus } : o));

        const { error } = await supabase
            .from('orders')
            .update({ order_status: newStatus })
            .eq('id', orderId);

        if (error) {
            toast.error('Помилка оновлення статусу');
            fetchOrders(); // Revert
        } else {
            // Inventory Automation
            if (newStatus === 'shipped') {
                await supabase.rpc('ship_order_stock', { p_order_id: orderId });
            }
            toast.success('Статус оновлено');
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleBatchDownload = async () => {
        if (selectedIds.size === 0) return;
        setDownloading(true);
        toast.loading('Формуємо архів PDF...');

        try {
            const zip = new JSZip();
            const selectedOrders = orders.filter(o => selectedIds.has(o.id));

            for (const order of selectedOrders) {
                // In a real app, you would fetch actual print PDFs.
                // Here we mock creating a text file representing the printing instructions
                const content = `Зміст замовлення ${order.order_number}:\n` +
                    order.items?.map((i: any) => `- ${i.name} (${i.options?.format} ${i.options?.cover} ${i.options?.pages} стор.) - ${i.qty} шт.`).join('\n') +
                    `\nКонтакти: ${order.customer_name}, ${order.delivery_method}, ${order.delivery_address}`;

                zip.file(`${order.order_number}_print.txt`, content);
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, `production_batch_${new Date().toISOString().slice(0, 10)}.zip`);
            toast.dismiss();
            toast.success('Архів завантажено');
            setSelectedIds(new Set()); // Clear selection
        } catch (e) {
            toast.dismiss();
            toast.error('Помилка формування архіву');
        }
        setDownloading(false);
    };

    const handleSingleDownload = async (order: any) => {
        toast.loading(`Формуємо PDF для ${order.order_number}...`);
        try {
            const zip = new JSZip();
            const content = `Зміст замовлення ${order.order_number}:\n` +
                order.items?.map((i: any) => `- ${i.name} (${i.options?.format} ${i.options?.cover} ${i.options?.pages} стор.) - ${i.qty} шт.`).join('\n') +
                `\nКонтакти: ${order.customer_name}, ${order.delivery_method}, ${order.delivery_address}`;

            zip.file(`${order.order_number}_print.txt`, content);
            const blob = await zip.generateAsync({ type: 'blob' });
            saveAs(blob, `print_${order.order_number}.zip`);
            toast.dismiss();
            toast.success('Завантажено');
        } catch (e) {
            toast.dismiss();
            toast.error('Помилка формування');
        }
    };

    const handleBatchMarkPrinted = async () => {
        if (selectedIds.size === 0) return;

        // Move all selected from "in_production" to "shipped"
        const idsToUpdate = Array.from(selectedIds);

        setOrders(prev => prev.map(o =>
            idsToUpdate.includes(o.id) && o.order_status === 'in_production'
                ? { ...o, order_status: 'shipped' }
                : o
        ));

        const { error } = await supabase
            .from('orders')
            .update({ order_status: 'shipped' })
            .in('id', idsToUpdate)
            .eq('order_status', 'in_production');

        if (!error) {
            // Inventory Automation
            for (const id of idsToUpdate) {
                await supabase.rpc('ship_order_stock', { p_order_id: id });
            }
            toast.success('Відмічено як надруковано');
            setSelectedIds(new Set());
        } else {
            toast.error('Помилка оновлення');
            fetchOrders();
        }
    };

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (deadlineFilter === 'all') return true;

            const startDate = order.paid_at || order.created_at;
            const deadline = addWorkingDays(startDate, 5);
            const status = getDeadlineStatus(deadline);

            if (deadlineFilter === 'today') return status === 'red'; // Treat overdue = today for this filter broadly
            if (deadlineFilter === 'tomorrow') return status === 'yellow';
            if (deadlineFilter === 'this_week') return status === 'green' || status === 'yellow';

            return true;
        });
    }, [orders, deadlineFilter]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}><Loader2 className="animate-spin" size={32} /></div>;
    }

    return (
        <div style={{ padding: '32px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px' }}>Виробництво 🏭</h1>
                    <p style={{ color: '#64748b' }}>Kanban дошка для відстеження друку</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <select
                        value={deadlineFilter}
                        onChange={e => setDeadlineFilter(e.target.value)}
                        style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none' }}
                    >
                        <option value="all">Усі дедлайни</option>
                        <option value="today">Сьогодні/Прострочено</option>
                        <option value="tomorrow">Завтра</option>
                        <option value="this_week">Цей тиждень</option>
                    </select>

                    {selectedIds.size > 0 && (
                        <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '4px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <button
                                onClick={handleBatchDownload}
                                disabled={downloading}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'white', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                            >
                                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                Завантажити PDF ({selectedIds.size})
                            </button>
                            <button
                                onClick={handleBatchMarkPrinted}
                                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', fontWeight: 600, cursor: 'pointer' }}
                            >
                                Готово до відправки
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(280px, 1fr))', gap: '24px', flex: 1, minHeight: 0 }}>
                {COLUMNS.map(column => {
                    const columnOrders = filteredOrders.filter(o => o.order_status === column.id);

                    return (
                        <div key={column.id} style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRadius: '20px', padding: '20px', border: '1px solid #eef2f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ fontWeight: 800, color: '#263A99' }}>{column.title}</h3>
                                <span style={{ background: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, color: '#64748b', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                    {columnOrders.length}
                                </span>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
                                <AnimatePresence>
                                    {columnOrders.map((order) => {
                                        const startDate = order.paid_at || order.created_at;
                                        const deadline = addWorkingDays(startDate, 5);
                                        const status = getDeadlineStatus(deadline);
                                        const isSelected = selectedIds.has(order.id);

                                        return (
                                            <motion.div
                                                layout
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                key={order.id}
                                                style={{
                                                    background: 'white',
                                                    padding: '16px',
                                                    borderRadius: '16px',
                                                    border: `1px solid ${isSelected ? 'var(--primary)' : '#e2e8f0'}`,
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                                                    position: 'relative'
                                                }}
                                            >
                                                {/* Card Header & Checkbox */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleSelection(order.id); }}
                                                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: isSelected ? 'var(--primary)' : '#cbd5e1' }}
                                                        >
                                                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                                                        </button>
                                                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#64748b' }}>{order.order_number}</span>
                                                    </div>

                                                    {/* Deadline Badge */}
                                                    <div style={{
                                                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, padding: '4px 8px', borderRadius: '8px',
                                                        background: status === 'red' ? '#fee2e2' : status === 'yellow' ? '#fef3c7' : '#dcfce7',
                                                        color: status === 'red' ? '#ef4444' : status === 'yellow' ? '#eab308' : '#22c55e'
                                                    }}>
                                                        <Calendar size={12} />
                                                        {formatUKDate(deadline)}
                                                    </div>
                                                </div>

                                                {/* Tags */}
                                                {order.order_tag_assignments?.length > 0 && (
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                                        {order.order_tag_assignments.map((assignment: any) => {
                                                            const tag = assignment.order_tags;
                                                            if (!tag) return null;
                                                            return (
                                                                <div
                                                                    key={tag.id}
                                                                    title={tag.name}
                                                                    style={{ padding: '2px 6px', borderRadius: '12px', backgroundColor: `${tag.color}15`, display: 'inline-flex', alignItems: 'center', gap: '4px', border: `1px solid ${tag.color}40`, fontSize: '11px', color: tag.color, fontWeight: 700 }}
                                                                >
                                                                    {tag.icon} {tag.name}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Alerts / Warnings */}
                                                {!order.designer_id && column.id !== 'delivered' && (
                                                    <div style={{ marginBottom: '12px', padding: '6px 10px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '8px', color: '#ea580c', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <User size={12} /> Не призначено дизайнера
                                                    </div>
                                                )}

                                                {/* Items summary */}
                                                <div style={{ marginBottom: '12px', fontSize: '13px', color: '#444' }}>
                                                    {order.items?.slice(0, 2).map((item: any, i: number) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
                                                            <Box size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#888' }} />
                                                            <span style={{ lineHeight: 1.3 }}>
                                                                <span style={{ fontWeight: 600 }}>{item.name}</span> <br />
                                                                <span style={{ color: '#888', fontSize: '12px' }}>
                                                                    {item.options?.format} • {item.options?.cover} • {item.options?.pages} стор. ({item.qty}шт)
                                                                </span>
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {(order.items?.length || 0) > 2 && (
                                                        <div style={{ fontSize: '12px', color: '#888', paddingLeft: '20px' }}>...та ще {(order.items?.length || 0) - 2}</div>
                                                    )}
                                                </div>

                                                {/* Customer */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                                                    <User size={14} />
                                                    {order.customer_name}, {order.delivery_address?.split(',')[0] || 'Місто не вказано'}
                                                </div>

                                                {/* Assigned Staff */}
                                                <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
                                                    {order.manager && (
                                                        <div
                                                            title={`Менеджер: ${order.manager.name}`}
                                                            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: order.manager.color || '#263A99', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                                                        >
                                                            {order.manager.initials}
                                                        </div>
                                                    )}
                                                    {order.designer && (
                                                        <div
                                                            title={`Дизайнер: ${order.designer.name}`}
                                                            style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: order.designer.color || '#ec4899', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, border: '2px solid white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', marginLeft: order.manager ? '-8px' : '0' }}
                                                        >
                                                            {order.designer.initials}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Actions Footer */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f0f4f8', paddingTop: '12px' }}>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleSingleDownload(order); }}
                                                        style={{ background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#94a3b8' }}
                                                        title="Завантажити PDF"
                                                    >
                                                        <Download size={16} />
                                                    </button>

                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        {column.id !== 'confirmed' && (
                                                            <button
                                                                onClick={() => handleStatusMove(order.id, column.id, 'prev')}
                                                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b' }}
                                                            >
                                                                <ChevronLeft size={16} />
                                                            </button>
                                                        )}
                                                        {column.id !== 'delivered' && (
                                                            <button
                                                                onClick={() => handleStatusMove(order.id, column.id, 'next')}
                                                                style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                Далі <ChevronRight size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                                {columnOrders.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '13px' }}>
                                        Немає замовлень
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

        </div>
    );
}
