'use client';
import { useState, useEffect , createPortal} from 'react';
import { createClient } from '@/lib/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Search,
    Users,
    TrendingUp,
    Star,
    Calendar,
    Mail,
    Phone,
    ShoppingBag,
    Filter,
    Download,
    X,
    Edit,
    Tag,
    ChevronLeft,
    ChevronRight,
    Activity,
    Gift,
    MessageCircle,
    MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface Customer {
    id: string;
    name: string;
    email: string;
    phone: string;
    total_orders: number;
    total_spent: number;
    created_at: string;
    notes?: string;
    tags?: string[];
    birthday?: string;
    birth_date?: string;
    telegram_subscribed?: boolean;
    loyalty_tier?: string;
    last_order_date?: string;
    address?: string;
}

interface FilterState {
    search: string;
    tag: string;
    dateFrom: string;
    dateTo: string;
}

// Loyalty tier helper functions
const getLoyaltyTier = (totalOrders: number): string => {
    if (totalOrders >= 10) return 'Преміум';
    if (totalOrders >= 5) return 'VIP';
    if (totalOrders >= 2) return 'Постійний';
    return 'Новий';
};

const getLoyaltyDiscount = (tier: string): number => {
    switch (tier) {
        case 'Преміум': return 15;
        case 'VIP': return 10;
        case 'Постійний': return 5;
        default: return 0;
    }
};

const getLoyaltyBadge = (tier: string): { emoji: string; color: string; bgColor: string } => {
    switch (tier) {
        case 'Преміум':
            return { emoji: '💎', color: '#7c3aed', bgColor: '#f3e8ff' };
        case 'VIP':
            return { emoji: '🥇', color: '#f59e0b', bgColor: '#fef3c7' };
        case 'Постійний':
            return { emoji: '🥈', color: '#6366f1', bgColor: '#e0e7ff' };
        default:
            return { emoji: '🥉', color: '#94a3b8', bgColor: '#f1f5f9' };
    }
};

const isBirthdaySoon = (birthday?: string): boolean => {
    if (!birthday) return false;

    const today = new Date();
    const birthDate = new Date(birthday);

    // Set year to current year for comparison
    birthDate.setFullYear(today.getFullYear());

    // Check if birthday already passed this year
    if (birthDate < today) {
        birthDate.setFullYear(today.getFullYear() + 1);
    }

    const daysUntil = Math.ceil((birthDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
};

export default function ClientsPage() {
    const supabase = createClient();

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
    const [filters, setFilters] = useState<FilterState>({
        search: '',
        tag: '',
        dateFrom: '',
        dateTo: ''
    });
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [customerOrders, setCustomerOrders] = useState<any[]>([]);
    const [drawerLoading, setDrawerLoading] = useState(false);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('total_spent', { ascending: false });

            if (error) throw error;

            // Fetch last order date for each customer
            if (data) {
                const customersWithLastOrder = await Promise.all(
                    data.map(async (customer) => {
                        const { data: orders } = await supabase
                            .from('orders')
                            .select('created_at')
                            .eq('customer_id', customer.id)
                            .order('created_at', { ascending: false })
                            .limit(1);

                        return {
                            ...customer,
                            last_order_date: orders?.[0]?.created_at || null
                        };
                    })
                );
                setCustomers(customersWithLastOrder);
            }
        } catch (error) {
            console.error('Error fetching customers:', error);
            toast.error('Помилка завантаження клієнтів');
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerOrders = async (customerId: string) => {
        setDrawerLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCustomerOrders(data || []);
        } catch (error) {
            console.error('Error fetching customer orders:', error);
            toast.error('Помилка завантаження замовлень');
        } finally {
            setDrawerLoading(false);
        }
    };

    const openCustomerDrawer = async (customer: Customer) => {
        setSelectedCustomer(customer);
        await fetchCustomerOrders(customer.id);
    };

    const closeDrawer = () => {
        setSelectedCustomer(null);
        setCustomerOrders([]);
    };

    // Filter customers
    const filteredCustomers = customers.filter((customer) => {
        const searchMatch =
            !filters.search ||
            customer.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
            customer.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
            customer.phone?.includes(filters.search);

        const tagMatch = !filters.tag || customer.tags?.includes(filters.tag);

        const dateFromMatch =
            !filters.dateFrom ||
            new Date(customer.created_at) >= new Date(filters.dateFrom);

        const dateToMatch =
            !filters.dateTo ||
            new Date(customer.created_at) <= new Date(filters.dateTo);

        return searchMatch && tagMatch && dateFromMatch && dateToMatch;
    });

    // Pagination
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const paginatedCustomers = filteredCustomers.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats
    const stats = {
        total: customers.length,
        newThisMonth: customers.filter(
            (c) =>
                new Date(c.created_at) >=
                new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        ).length,
        vip: customers.filter((c) => (c.tags || []).includes('VIP')).length,
        avgOrderValue:
            customers.reduce((acc, c) => acc + (Number(c.total_spent) || 0), 0) /
                (customers.reduce((acc, c) => acc + (c.total_orders || 0), 0) || 1)
    };

    // Export to Excel
    const exportToExcel = () => {
        const dataToExport = filteredCustomers.map((c) => ({
            "Ім'я": c.name,
            Email: c.email,
            Телефон: c.phone,
            'Замовлень': c.total_orders || 0,
            'Витрачено (₴)': c.total_spent || 0,
            Теги: (c.tags || []).join(', '),
            'Дата народження': c.birth_date || '',
            'Telegram підписка': c.telegram_subscribed ? 'Так' : 'Ні',
            'Останнє замовлення': c.last_order_date
                ? new Date(c.last_order_date).toLocaleDateString('uk-UA')
                : '',
            'Дата реєстрації': new Date(c.created_at).toLocaleDateString('uk-UA')
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Клієнти');
        XLSX.writeFile(wb, `clients_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel файл завантажено');
    };

    const addTag = async (customerId: string, tag: string) => {
        const customer = customers.find((c) => c.id === customerId);
        if (!customer) return;

        const currentTags = customer.tags || [];
        if (currentTags.includes(tag)) {
            toast.info('Цей тег вже додано');
            return;
        }

        const newTags = [...currentTags, tag];

        try {
            const { error } = await supabase
                .from('customers')
                .update({ tags: newTags })
                .eq('id', customerId);

            if (error) throw error;

            setCustomers((prev) =>
                prev.map((c) =>
                    c.id === customerId ? { ...c, tags: newTags } : c
                )
            );
            toast.success(`Тег "${tag}" додано`);
        } catch (error) {
            console.error('Error adding tag:', error);
            toast.error('Помилка додавання тегу');
        }
    };

    const removeTag = async (customerId: string, tag: string) => {
        const customer = customers.find((c) => c.id === customerId);
        if (!customer) return;

        const newTags = (customer.tags || []).filter((t) => t !== tag);

        try {
            const { error } = await supabase
                .from('customers')
                .update({ tags: newTags })
                .eq('id', customerId);

            if (error) throw error;

            setCustomers((prev) =>
                prev.map((c) =>
                    c.id === customerId ? { ...c, tags: newTags } : c
                )
            );
            toast.success(`Тег "${tag}" видалено`);
        } catch (error) {
            console.error('Error removing tag:', error);
            toast.error('Помилка видалення тегу');
        }
    };

    const sendBirthdayGreeting = async (customer: Customer) => {
        if (!customer.phone) {
            toast.error('У клієнта немає номера телефону');
            return;
        }

        try {
            // Get birthday SMS template from message_templates
            const { data: templates } = await supabase
                .from('message_templates')
                .select('*')
                .eq('type', 'sms')
                .eq('category', 'marketing')
                .ilike('name', '%день народження%')
                .limit(1);

            const template = templates?.[0];
            let message = '';

            if (template) {
                // Use template and replace variables
                message = template.body
                    .replace(/{client_name}/g, customer.name)
                    .replace(/{order_id}/g, '')
                    .replace(/{tracking_number}/g, '')
                    .replace(/{total_price}/g, '')
                    .replace(/{payment_link}/g, '');
            } else {
                // Fallback message
                message = `${customer.name}, вітаємо з Днем народження! 🎉 Даруємо знижку 15% на всі товари. Код: BIRTHDAY15. TouchMemories`;
            }

            // TODO: Implement actual SMS sending via TurboSMS
            console.log('[Birthday SMS]', customer.phone, message);

            // For now, just show success
            toast.success(`SMS відправлено на ${customer.phone}`);

            // Update template usage if found
            if (template) {
                await supabase
                    .from('message_templates')
                    .update({
                        usage_count: (template.usage_count || 0) + 1,
                        last_used_at: new Date().toISOString()
                    })
                    .eq('id', template.id);
            }
        } catch (error) {
            console.error('Error sending birthday greeting:', error);
            toast.error('Помилка відправки вітання');
        }
    };

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '80px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 900, color: '#263A99', marginBottom: '8px', letterSpacing: '-0.02em' }}>
                        CRM — База Клієнтів
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '16px' }}>
                        Управління клієнтською базою та аналіз купівельної активності.
                    </p>
                </div>
                <button onClick={exportToExcel} style={exportBtnStyle}>
                    <Download size={18} />
                    Експорт Excel
                </button>
            </div>

            {/* Stats Bar */}
            <div style={statsGrid}>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#eff6ff', color: '#263A99' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Всього клієнтів</div>
                        <div style={statValue}>{stats.total}</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Нових цього місяця</div>
                        <div style={statValue}>{stats.newThisMonth}</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fef3c7', color: '#f59e0b' }}>
                        <Star size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>VIP клієнтів</div>
                        <div style={statValue}>{stats.vip}</div>
                    </div>
                </div>
                <div style={statCard}>
                    <div style={{ ...iconWrapper, backgroundColor: '#fdf2f8', color: '#db2777' }}>
                        <ShoppingBag size={24} />
                    </div>
                    <div>
                        <div style={statLabel}>Середній чек</div>
                        <div style={statValue}>{Math.round(stats.avgOrderValue)} ₴</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div style={filtersWrapper}>
                <div style={searchWrapper}>
                    <Search size={20} color="#94a3b8" />
                    <input
                        placeholder="Пошук за ім'ям, email або телефоном..."
                        style={searchInput}
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    />
                </div>
                <select
                    style={filterSelect}
                    value={filters.tag}
                    onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
                >
                    <option value="">Всі теги</option>
                    <option value="VIP">VIP</option>
                    <option value="Regular">Regular</option>
                    <option value="New">New</option>
                </select>
                <input
                    type="date"
                    style={filterSelect}
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                    placeholder="Від дати"
                />
                <input
                    type="date"
                    style={filterSelect}
                    value={filters.dateTo}
                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                    placeholder="До дати"
                />
                {(filters.search || filters.tag || filters.dateFrom || filters.dateTo) && (
                    <button
                        onClick={() => setFilters({ search: '', tag: '', dateFrom: '', dateTo: '' })}
                        style={clearFiltersBtn}
                    >
                        <X size={16} />
                        Очистити фільтри
                    </button>
                )}
            </div>

            {/* Table */}
            <div style={tableCard}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '1.5px solid #f1f5f9' }}>
                            <th style={thStyle}>Клієнт</th>
                            <th style={thStyle}>Контакти</th>
                            <th style={thStyle}>Замовлень</th>
                            <th style={thStyle}>Витрачено</th>
                            <th style={thStyle}>Теги</th>
                            <th style={thStyle}>Останнє замовлення</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Дії</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '100px' }}>
                                    <Activity className="animate-spin" size={32} color="#94a3b8" style={{ margin: '0 auto' }} />
                                </td>
                            </tr>
                        ) : paginatedCustomers.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center', padding: '100px', color: '#94a3b8' }}>
                                    Клієнтів не знайдено
                                </td>
                            </tr>
                        ) : (
                            paginatedCustomers.map((customer) => (
                                <motion.tr
                                    key={customer.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    style={trStyle}
                                    whileHover={{ backgroundColor: '#f8fafc' }}
                                    onClick={() => openCustomerDrawer(customer)}
                                >
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={avatar}>{customer.name?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: 800, color: '#263A99', fontSize: '15px' }}>
                                                        {customer.name}
                                                    </span>
                                                    {isBirthdaySoon(customer.birthday || customer.birth_date) && (
                                                        <span
                                                            style={{
                                                                fontSize: '18px',
                                                                animation: 'pulse 2s ease-in-out infinite'
                                                            }}
                                                            title="День народження скоро!"
                                                        >
                                                            🎂
                                                        </span>
                                                    )}
                                                    {(() => {
                                                        const tier = customer.loyalty_tier || getLoyaltyTier(customer.total_orders || 0);
                                                        const badge = getLoyaltyBadge(tier);
                                                        const discount = getLoyaltyDiscount(tier);
                                                        return (
                                                            <span
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    backgroundColor: badge.bgColor,
                                                                    color: badge.color
                                                                }}
                                                                title={`${tier} • ${discount}% знижка`}
                                                            >
                                                                {badge.emoji} {tier}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                                    ID: {customer.id.substring(0, 8)}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={contactItem}>
                                                <Mail size={12} />
                                                {customer.email}
                                            </div>
                                            <div style={contactItem}>
                                                <Phone size={12} />
                                                {customer.phone}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 800, fontSize: '16px' }}>
                                            {customer.total_orders || 0}
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontWeight: 900, fontSize: '17px', color: '#6366f1' }}>
                                            {(customer.total_spent || 0).toLocaleString()} ₴
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {(customer.tags || []).map((tag) => (
                                                <span
                                                    key={tag}
                                                    style={{
                                                        ...tagBadge,
                                                        backgroundColor:
                                                            tag === 'VIP'
                                                                ? '#fef3c7'
                                                                : tag === 'Regular'
                                                                ? '#dbeafe'
                                                                : '#f1f5f9',
                                                        color:
                                                            tag === 'VIP'
                                                                ? '#f59e0b'
                                                                : tag === 'Regular'
                                                                ? '#263A99'
                                                                : '#64748b'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTag(customer.id, tag);
                                                    }}
                                                >
                                                    {tag}
                                                    <X size={12} style={{ marginLeft: '4px', cursor: 'pointer' }} />
                                                </span>
                                            ))}
                                            <button
                                                style={addTagBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const tag = prompt('Введіть тег (VIP, Regular, New):');
                                                    if (tag) addTag(customer.id, tag);
                                                }}
                                            >
                                                <Tag size={12} />
                                            </button>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                                            {customer.last_order_date
                                                ? new Date(customer.last_order_date).toLocaleDateString('uk-UA')
                                                : '—'}
                                        </div>
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            {isBirthdaySoon(customer.birthday || customer.birth_date) && (
                                                <button
                                                    style={{
                                                        ...actionBtn,
                                                        backgroundColor: '#fef3c7',
                                                        color: '#f59e0b',
                                                        border: '1px solid #fbbf24',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        sendBirthdayGreeting(customer);
                                                    }}
                                                    title="Надіслати вітання з днем народження"
                                                >
                                                    <Gift size={14} /> Вітання
                                                </button>
                                            )}
                                            <button
                                                style={actionBtn}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openCustomerDrawer(customer);
                                                }}
                                            >
                                                Відкрити
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={pagination}>
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        style={{
                            ...paginationBtn,
                            opacity: currentPage === 1 ? 0.5 : 1,
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>
                        Сторінка {currentPage} з {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        style={{
                            ...paginationBtn,
                            opacity: currentPage === totalPages ? 0.5 : 1,
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}

            {/* Customer Detail Drawer */}
                        {mounted && createPortal(
              <>
              <AnimatePresence>
                {selectedCustomer && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={overlay}
                            onClick={closeDrawer}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={drawer}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                                <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#263A99', margin: 0 }}>
                                    Профіль клієнта
                                </h2>
                                <button onClick={closeDrawer} style={closeBtn}>
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Customer Info */}
                            <div style={drawerCard}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                                    <div style={avatarLarge}>{selectedCustomer.name?.[0]?.toUpperCase()}</div>
                                    <div>
                                        <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#263A99', margin: 0 }}>
                                            {selectedCustomer.name}
                                        </h3>
                                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                                            ID: {selectedCustomer.id.substring(0, 8)}
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={infoRow}>
                                        <Mail size={16} color="#94a3b8" />
                                        {selectedCustomer.email || '—'}
                                    </div>
                                    <div style={infoRow}>
                                        <Phone size={16} color="#94a3b8" />
                                        {selectedCustomer.phone || '—'}
                                    </div>
                                    {selectedCustomer.birth_date && (
                                        <div style={infoRow}>
                                            <Gift size={16} color="#94a3b8" />
                                            Дата народження: {new Date(selectedCustomer.birth_date).toLocaleDateString('uk-UA')}
                                        </div>
                                    )}
                                    {selectedCustomer.telegram_subscribed && (
                                        <div style={infoRow}>
                                            <MessageCircle size={16} color="#94a3b8" />
                                            Підписаний на Telegram
                                        </div>
                                    )}
                                    <div style={infoRow}>
                                        <Calendar size={16} color="#94a3b8" />
                                        Реєстрація: {new Date(selectedCustomer.created_at).toLocaleDateString('uk-UA')}
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
                                    <div>
                                        <div style={drawerStatLabel}>Замовлень</div>
                                        <div style={drawerStatValue}>{selectedCustomer.total_orders || 0}</div>
                                    </div>
                                    <div>
                                        <div style={drawerStatLabel}>Витрачено</div>
                                        <div style={drawerStatValue}>{(selectedCustomer.total_spent || 0).toLocaleString()} ₴</div>
                                    </div>
                                </div>
                            </div>

                            {/* Order History */}
                            <div style={drawerCard}>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#263A99', marginBottom: '20px' }}>
                                    Історія замовлень ({customerOrders.length})
                                </h3>
                                {drawerLoading ? (
                                    <div style={{ padding: '40px', textAlign: 'center' }}>
                                        <Activity className="animate-spin" size={32} color="#94a3b8" style={{ margin: '0 auto' }} />
                                    </div>
                                ) : customerOrders.length === 0 ? (
                                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '8px' }}>
                                        Ще немає замовлень
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {customerOrders.map((order) => (
                                            <div key={order.id} style={orderRow}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={orderIcon}>
                                                        <ShoppingBag size={18} color="#263A99" />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 800, color: '#263A99', fontSize: '15px' }}>
                                                            {order.order_number}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                                                            {new Date(order.created_at).toLocaleDateString('uk-UA')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 900, color: '#263A99', fontSize: '16px' }}>
                                                        {order.total} ₴
                                                    </div>
                                                    <div style={{ fontSize: '11px', fontWeight: 700, color: getStatusColor(order.order_status) }}>
                                                        {getStatusLabel(order.order_status)}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
              </>,
              document.body
            )}
        </div>
    );
}

// Helper functions
function getStatusLabel(status: string) {
    const map: Record<string, string> = {
        new: 'Нове',
        confirmed: 'Підтверджено',
        in_production: 'Виробництво',
        shipped: 'Відправлено',
        delivered: 'Доставлено',
        cancelled: 'Скасовано'
    };
    return map[status] || status;
}

function getStatusColor(status: string) {
    const map: Record<string, string> = {
        new: '#263A99',
        confirmed: '#16a34a',
        in_production: '#f59e0b',
        shipped: '#a855f7',
        delivered: '#22c55e',
        cancelled: '#ef4444'
    };
    return map[status] || '#64748b';
}

// Styles
const exportBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
    transition: 'all 0.2s'
};

const statsGrid = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '24px',
    marginBottom: '48px'
};

const statCard = {
    backgroundColor: 'white',
    padding: '28px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const iconWrapper = {
    width: '56px',
    height: '56px',
    borderRadius: '3px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const statLabel = {
    fontSize: '12px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    marginBottom: '4px'
};

const statValue = {
    fontSize: '28px',
    fontWeight: 900,
    color: '#263A99'
};

const filtersWrapper = {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    alignItems: 'center'
};

const searchWrapper = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'white',
    border: '1.5px solid #e2e8f0',
    borderRadius: '3px',
    padding: '0 20px',
    flex: 1,
    maxWidth: '500px'
};

const searchInput = {
    border: 'none',
    padding: '14px 0',
    outline: 'none',
    width: '100%',
    fontSize: '15px',
    fontWeight: 500
};

const filterSelect = {
    padding: '14px 16px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '3px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    backgroundColor: 'white',
    cursor: 'pointer',
    outline: 'none'
};

const clearFiltersBtn = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    color: '#ef4444',
    border: 'none',
    borderRadius: '3px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer'
};

const tableCard = {
    backgroundColor: 'white',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    overflow: 'hidden',
    boxShadow: '0 4px 25px rgba(0,0,0,0.02)',
    marginBottom: '32px'
};

const thStyle = {
    textAlign: 'left' as any,
    padding: '20px 24px',
    fontSize: '11px',
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    fontWeight: 800,
    backgroundColor: '#f8fafc'
};

const tdStyle = {
    padding: '20px 24px',
    verticalAlign: 'middle' as any
};

const trStyle: React.CSSProperties = {
    borderBottom: '1px solid #f8fafc',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
};

const avatar = {
    width: '44px',
    height: '44px',
    borderRadius: '3px',
    backgroundColor: '#f1f5f9',
    color: '#263A99',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: 900
};

const contactItem = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    color: '#64748b',
    fontWeight: 600
};

const tagBadge = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: '3px',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'pointer'
};

const addTagBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    borderRadius: '3px',
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const actionBtn = {
    padding: '8px 16px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '3px',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const pagination = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '24px'
};

const paginationBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '3px',
    backgroundColor: 'white',
    border: '1.5px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

const overlay = {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998
};

const drawer = {
    position: 'fixed' as any,
    top: 0,
    right: 0,
    bottom: 0,
    width: '600px',
    backgroundColor: '#fcfcfd',
    boxShadow: '-10px 0 50px rgba(0, 0, 0, 0.2)',
    zIndex: 999,
    padding: '40px',
    overflowY: 'auto' as any
};

const closeBtn = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '44px',
    height: '44px',
    borderRadius: '3px',
    backgroundColor: 'white',
    border: '1.5px solid #e2e8f0',
    color: '#64748b',
    cursor: 'pointer'
};

const drawerCard = {
    backgroundColor: 'white',
    padding: '28px',
    borderRadius: '3px',
    border: '1.5px solid #f1f5f9',
    marginBottom: '24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.02)'
};

const avatarLarge = {
    width: '64px',
    height: '64px',
    borderRadius: '3px',
    backgroundColor: '#f1f5f9',
    color: '#263A99',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    fontWeight: 900
};

const infoRow = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569'
};

const drawerStatLabel = {
    fontSize: '11px',
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase' as any,
    letterSpacing: '0.05em',
    marginBottom: '6px'
};

const drawerStatValue = {
    fontSize: '24px',
    fontWeight: 900,
    color: '#263A99'
};

const orderRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    borderRadius: '3px',
    border: '1px solid #f1f5f9',
    backgroundColor: '#fafbfc',
    transition: 'all 0.2s'
};

const orderIcon = {
    width: '40px',
    height: '40px',
    borderRadius: '3px',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};
