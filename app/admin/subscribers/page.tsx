'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Download, Mail, Search, RefreshCw } from 'lucide-react';

interface Subscriber {
    id: string;
    email: string;
    is_active: boolean;
    subscribed_at: string;
    segments: string[] | null;
    source: string | null;
    promo_code: string | null;
}

export default function SubscribersPage() {
    const supabase = createClient();
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [filtered, setFiltered] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');

    useEffect(() => {
        fetchSubscribers();
    }, []);

    useEffect(() => {
        let result = [...subscribers];
        if (filterActive === 'active') result = result.filter(s => s.is_active);
        if (filterActive === 'inactive') result = result.filter(s => !s.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(s =>
                s.email.toLowerCase().includes(q) ||
                s.source?.toLowerCase().includes(q) ||
                s.promo_code?.toLowerCase().includes(q)
            );
        }
        setFiltered(result);
    }, [subscribers, search, filterActive]);

    async function fetchSubscribers() {
        setLoading(true);
        const { data, error } = await supabase
            .from('subscribers')
            .select('*')
            .order('subscribed_at', { ascending: false });

        if (error) {
            console.error('Error fetching subscribers:', error);
        }
        setSubscribers(data || []);
        setLoading(false);
    }

    function exportCSV() {
        const headers = ['Email', 'Source', 'Promo Code', 'Subscribed At', 'Active', 'Segments'];
        const rows = filtered.map(s => [
            s.email,
            s.source || '',
            s.promo_code || '',
            s.subscribed_at ? new Date(s.subscribed_at).toLocaleString('uk-UA') : '',
            s.is_active ? 'Так' : 'Ні',
            s.segments?.join(', ') || ''
        ]);

        const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `subscribers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const activeCount = subscribers.filter(s => s.is_active).length;
    const inactiveCount = subscribers.filter(s => !s.is_active).length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Mail size={24} />
                        Підписники
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Всього: {subscribers.length} | Активних: {activeCount} | Неактивних: {inactiveCount}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchSubscribers}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                    >
                        <RefreshCw size={16} />
                        Оновити
                    </button>
                    <button
                        onClick={exportCSV}
                        className="flex items-center gap-2 px-4 py-2 bg-[#1e2d7d] text-white rounded-lg hover:bg-[#263a99] text-sm font-medium"
                    >
                        <Download size={16} />
                        Експорт CSV
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Пошук за email, джерелом або промокодом..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e2d7d]/30 focus:border-[#1e2d7d]"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'active', 'inactive'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterActive(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                filterActive === f
                                    ? 'bg-[#1e2d7d] text-white border-[#1e2d7d]'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            {f === 'all' ? `Всі (${subscribers.length})` : f === 'active' ? `Активні (${activeCount})` : `Неактивні (${inactiveCount})`}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1e2d7d]"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                    {search ? `Нічого не знайдено за "${search}"` : 'Немає підписників'}
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Email</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Джерело</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Промокод</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Дата підписки</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-700">Статус</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(sub => (
                                    <tr key={sub.id} className="border-b border-gray-100 hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium text-gray-900">{sub.email}</td>
                                        <td className="px-4 py-3 text-gray-600">{sub.source || '—'}</td>
                                        <td className="px-4 py-3">
                                            {sub.promo_code ? (
                                                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                                                    {sub.promo_code}
                                                </span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleString('uk-UA', {
                                                day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                            }) : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                                sub.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                            }`}>
                                                {sub.is_active ? 'Активний' : 'Неактивний'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 text-sm text-gray-500 border-t">
                        Показано {filtered.length} з {subscribers.length} підписників
                    </div>
                </div>
            )}
        </div>
    );
}
