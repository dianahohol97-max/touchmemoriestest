'use client';
import { useState, useEffect } from 'react';
import {
    Loader2,
    Download,
    Save,
    CheckCircle,
    Calculator,
    Calendar as CalendarIcon,
    User,
    TrendingUp,
    AlertCircle,
    FileText,
    ChevronRight,
    Search,
    Filter,
    Clock,
    DollarSign,
    MinusCircle,
    PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { exportSalariesToExcel } from '@/lib/export/excel';

export default function SalaryPage() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const [dateFrom, setDateFrom] = useState(firstDay);
    const [dateTo, setDateTo] = useState(lastDay);
    const [activeTab, setActiveTab] = useState('manager'); // manager, designer, production
    const [salaries, setSalaries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [calcProcessing, setCalcProcessing] = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

    useEffect(() => {
        fetchSalaries();
    }, [dateFrom, dateTo]);

    const fetchSalaries = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/salary?from=${dateFrom}&to=${dateTo}`);
            if (res.ok) {
                const data = await res.json();
                setSalaries(data);
            }
        } catch (e) {
            toast.error('Помилка завантаження');
        } finally {
            setLoading(false);
        }
    };

    const runCalculation = async () => {
        setCalcProcessing(true);
        const tid = toast.loading('Розрахунок...');
        try {
            const res = await fetch('/api/admin/salary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from: dateFrom, to: dateTo })
            });
            if (res.ok) {
                toast.success('Період розраховано', { id: tid });
                fetchSalaries();
            } else {
                toast.error('Помилка розрахунку', { id: tid });
            }
        } catch (e) {
            toast.error('Помилка системи', { id: tid });
        } finally {
            setCalcProcessing(false);
        }
    };

    const updateSalaryStatus = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/admin/salary/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success('Статус оновлено');
                setSalaries(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
            }
        } catch (e) {
            toast.error('Помилка оновлення');
        }
    };

    const filteredSalaries = salaries.filter(s => {
        const matchesTab = s.staff?.role === activeTab || (activeTab === 'production' && s.staff?.name.toLowerCase().includes('андрій'));
        const matchesSearch = s.staff?.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    return (
        <div style={{ maxWidth: '100%', paddingBottom: '100px' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 950, letterSpacing: '-0.02em', marginBottom: '8px' }}>Розрахунок Зарплат 💸</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '15px' }}>
                        <Clock size={16} />
                        <span>Керування виплатами та бонусами команди</span>
                    </div>
                </div>

                <div style={controlsContainer}>
                    <div style={datePickerGroup}>
                        <div style={dateInputWrapper}>
                            <label style={miniLabel}>З</label>
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={dateInput} />
                        </div>
                        <div style={dateInputWrapper}>
                            <label style={miniLabel}>ПО</label>
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={dateInput} />
                        </div>
                    </div>

                    <button
                        onClick={runCalculation}
                        disabled={calcProcessing}
                        style={{ ...primaryBtn, opacity: calcProcessing ? 0.7 : 1 }}
                    >
                        {calcProcessing ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
                        Розрахувати
                    </button>

                    <button
                        onClick={() => exportSalariesToExcel(filteredSalaries, `salaries_${dateFrom}_${dateTo}.xlsx`)}
                        style={secondaryBtn}
                    >
                        <Download size={18} />
                        Excel
                    </button>
                </div>
            </div>

            {/* Main Content Layout */}
            <div style={mainGrid}>
                {/* Sidebar / Filters */}
                <div style={sidebar}>
                    <div style={searchContainer}>
                        <Search size={18} color="#94a3b8" />
                        <input
                            type="text"
                            placeholder="Пошук співробітника..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={searchInput}
                        />
                    </div>

                    <div style={tabsContainer}>
                        <button onClick={() => setActiveTab('manager')} style={{ ...tabBtn, ...(activeTab === 'manager' ? activeTabBtn : {}) }}>
                            <User size={18} />
                            Менеджери
                        </button>
                        <button onClick={() => setActiveTab('designer')} style={{ ...tabBtn, ...(activeTab === 'designer' ? activeTabBtn : {}) }}>
                            <FileText size={18} />
                            Дизайнери
                        </button>
                        <button onClick={() => setActiveTab('production')} style={{ ...tabBtn, ...(activeTab === 'production' ? activeTabBtn : {}) }}>
                            <TrendingUp size={18} />
                            Виробництво
                        </button>
                    </div>

                    <div style={statsOverview}>
                        <div style={miniStat}>
                            <span style={miniStatLabel}>Нараховано</span>
                            <span style={miniStatValue}>
                                {filteredSalaries.reduce((sum, s) => sum + Number(s.total_amount), 0).toLocaleString()} ₴
                            </span>
                        </div>
                    </div>
                </div>

                {/* Salary List */}
                <div style={contentArea}>
                    <AnimatePresence mode="wait">
                        {loading ? (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={loaderContainer}>
                                <Loader2 size={40} className="animate-spin" color="#6366f1" />
                            </motion.div>
                        ) : filteredSalaries.length > 0 ? (
                            <div style={listContainer}>
                                {filteredSalaries.map(salary => (
                                    <SalaryCard
                                        key={salary.id}
                                        salary={salary}
                                        onStatusUpdate={updateSalaryStatus}
                                    />
                                ))}
                            </div>
                        ) : (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={emptyState}>
                                <div style={emptyIcon}><Search size={32} /></div>
                                <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>Нічого не знайдено</h3>
                                <p style={{ color: '#64748b' }}>Спробуйте змінити період або фільтри</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function SalaryCard({ salary, onStatusUpdate }: any) {
    const [expanded, setExpanded] = useState(false);
    const staff = salary.staff;
    const breakdown = salary.breakdown || {};

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={card}
        >
            <div style={cardTop}>
                <div style={staffInfo}>
                    <div style={{ ...avatar, backgroundColor: (staff.color || '#6366f1') + '20', color: staff.color || '#6366f1' }}>
                        {staff.initials}
                    </div>
                    <div>
                        <h3 style={staffName}>{staff.name}</h3>
                        <div style={staffRole}>{staff.role === 'admin' ? 'Адміністрація' : staff.role === 'manager' ? 'Менеджер' : 'Дизайнер'}</div>
                    </div>
                </div>

                <div style={cardMetrics}>
                    <div style={totalContainer}>
                        <span style={totalLabel}>Разом</span>
                        <div style={totalValue}>{Number(salary.total_amount).toLocaleString()} ₴</div>
                    </div>

                    <div style={statusGroup}>
                        <StatusBadge status={salary.status} />
                        <button onClick={() => setExpanded(!expanded)} style={expandBtn}>
                            <ChevronRight size={20} style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: '0.3s' }} />
                        </button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={breakdownContainer}>
                            <h4 style={breakdownTitle}>Деталізація нарахувань</h4>
                            <div style={breakdownList}>
                                {Object.entries(breakdown).map(([key, item]: [string, any]) => (
                                    <div key={key} style={breakdownRow}>
                                        <div style={itemInfo}>
                                            <span style={itemName}>{item.label}</span>
                                            {item.details && <span style={itemSub}>{item.details}</span>}
                                            {item.note && <span style={itemNote}>{item.note}</span>}
                                        </div>
                                        <div style={{ ...itemValue, color: item.value < 0 ? '#ef4444' : '#263A99' }}>
                                            {item.value > 0 ? '+' : ''}{item.value.toLocaleString()} ₴
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div style={actionRow}>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button onClick={() => onStatusUpdate(salary.id, 'paid')} style={actionBtn}>
                                        <CheckCircle size={16} /> Позначити як виплачено
                                    </button>
                                    <button style={actionBtnAlt}>
                                        <PlusCircle size={16} /> Додати бонус
                                    </button>
                                </div>
                                <div style={lastUpdated}>Оновлено: {new Date(salary.updated_at).toLocaleDateString()}</div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: any = {
        draft: { label: 'Чернетка', color: '#64748b', bg: '#f1f5f9' },
        approved: { label: 'Затверджено', color: '#d97706', bg: '#fffbeb' },
        paid: { label: 'Виплачено', color: '#16a34a', bg: '#f0fdf4' },
    };
    const s = config[status] || config.draft;
    return (
        <span style={{
            fontSize: '11px',
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: '100px',
            backgroundColor: s.bg,
            color: s.color,
            textTransform: 'uppercase'
        }}>
            {s.label}
        </span>
    );
}

// Styles
const controlsContainer = { display: 'flex', gap: '16px', alignItems: 'center' };
const datePickerGroup = { display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '16px', gap: '4px', border: '1.5px solid #e2e8f0' };
const dateInputWrapper = { display: 'flex', flexDirection: 'column' as any, padding: '4px 12px' };
const miniLabel = { fontSize: '10px', fontWeight: 900, color: '#94a3b8', marginBottom: '2px' };
const dateInput = { border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 700, color: '#263A99', outline: 'none' };

const primaryBtn = { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#6366f1', color: 'white', border: 'none', padding: '14px 24px', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer', boxShadow: '0 10px 20px rgba(99, 102, 241, 0.2)' };
const secondaryBtn = { display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'white', color: '#263A99', border: '1.5px solid #e2e8f0', padding: '14px 24px', borderRadius: '16px', fontWeight: 800, fontSize: '14px', cursor: 'pointer' };

const mainGrid = { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '40px', alignItems: 'start' };
const sidebar = { display: 'flex', flexDirection: 'column' as any, gap: '24px', position: 'sticky' as any, top: '40px' };

const searchContainer = { display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: '#f8fafc', border: '1.5px solid #e2e8f0', padding: '12px 16px', borderRadius: '16px' };
const searchInput = { border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '14px', fontWeight: 600 };

const tabsContainer = { display: 'flex', flexDirection: 'column' as any, gap: '8px' };
const tabBtn = { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderRadius: '16px', border: 'none', background: 'none', textAlign: 'left' as any, cursor: 'pointer', fontSize: '15px', fontWeight: 700, color: '#64748b', transition: '0.2s' };
const activeTabBtn = { background: 'white', color: '#6366f1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9' };

const statsOverview = { padding: '24px', backgroundColor: '#6366f1', borderRadius: '32px', color: 'white', backgroundImage: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' };
const miniStat = { display: 'flex', flexDirection: 'column' as any };
const miniStatLabel = { fontSize: '12px', fontWeight: 700, opacity: 0.8, marginBottom: '4px' };
const miniStatValue = { fontSize: '24px', fontWeight: 900 };

const contentArea = { minHeight: '600px' };
const listContainer = { display: 'flex', flexDirection: 'column' as any, gap: '20px' };
const loaderContainer = { display: 'flex', justifyContent: 'center', paddingTop: '100px' };

const cardBase = { backgroundColor: 'white', borderRadius: '32px', border: '1.5px solid #f1f5f9', overflow: 'hidden', transition: '0.3s' };
const card = { ...cardBase, boxShadow: '0 4px 6px rgba(0,0,0,0.02)' };

const cardTop = { padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const staffInfo = { display: 'flex', alignItems: 'center', gap: '20px' };
const avatar = { width: '56px', height: '56px', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 900 };
const staffName = { fontSize: '18px', fontWeight: 900, marginBottom: '2px', color: '#263A99' };
const staffRole = { fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' as any, letterSpacing: '0.02em' };

const cardMetrics = { display: 'flex', alignItems: 'center', gap: '40px' };
const totalContainer = { textAlign: 'right' as any };
const totalLabel = { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' as any, marginBottom: '2px' };
const totalValue = { fontSize: '24px', fontWeight: 950, color: '#10b981' };

const statusGroup = { display: 'flex', alignItems: 'center', gap: '16px' };
const expandBtn = { border: 'none', background: '#f8fafc', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' };

const breakdownContainer = { padding: '0 32px 32px 32px', borderTop: '1px solid #f1f5f9', paddingTop: '32px' };
const breakdownTitle = { fontSize: '14px', fontWeight: 900, color: '#263A99', marginBottom: '20px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
const breakdownList = { display: 'flex', flexDirection: 'column' as any, gap: '12px', marginBottom: '32px' };
const breakdownRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: '#f8fafc', borderRadius: '20px' };
const itemInfo = { display: 'flex', flexDirection: 'column' as any, gap: '2px' };
const itemName = { fontSize: '14px', fontWeight: 800, color: '#263A99' };
const itemSub = { fontSize: '12px', fontWeight: 600, color: '#94a3b8' };
const itemNote = { fontSize: '12px', fontWeight: 700, color: '#d97706', marginTop: '4px' };
const itemValue = { fontSize: '16px', fontWeight: 900 };

const actionRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #e2e8f0', paddingTop: '24px' };
const actionBtn = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: 'none', backgroundColor: '#263A99', color: 'white', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };
const actionBtnAlt = { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', border: '1.5px solid #e2e8f0', backgroundColor: 'white', color: '#263A99', fontWeight: 700, fontSize: '13px', cursor: 'pointer' };
const lastUpdated = { fontSize: '12px', color: '#94a3b8', fontWeight: 600 };

const emptyState = { display: 'flex', flexDirection: 'column' as any, alignItems: 'center', justifyContent: 'center', textAlign: 'center' as any, padding: '100px 20px' };
const emptyIcon = { width: '80px', height: '80px', borderRadius: '30px', backgroundColor: '#f1f5f9', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' };
