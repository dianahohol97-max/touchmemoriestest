'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DollarSign, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function RolePricingPage() {
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Products list map
    const [products, setProducts] = useState<any[]>([]);

    // role pricing mapping: { [product_id_role]: { price?, discount_percent? } }
    const [pricingMap, setPricingMap] = useState<Record<string, any>>({});

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [{ data: prodData }, { data: priceData }] = await Promise.all([
                supabase.from('products').select('id, name, price, cover_options, format_options').order('name'),
                supabase.from('role_pricing').select('*')
            ]);

            if (prodData) {
                setProducts(prodData);
            }
            if (priceData) {
                const map: Record<string, any> = {};
                priceData.forEach(p => {
                    map[`${p.product_id}_${p.role}`] = { ...p };
                });
                setPricingMap(map);
            }
        } catch (error) {
            console.error('Failed to load role pricing data:', error);
            toast.error('Помилка завантаження');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const upserts = [];
            for (const key in pricingMap) {
                const parts = key.split('_');
                const role = parts.pop();
                const product_id = parts.join('_');

                const curr = pricingMap[key];

                // validate
                if (curr.price !== '' || curr.discount_percent !== '') {
                    upserts.push({
                        product_id,
                        role,
                        price: curr.price !== '' && curr.price !== null && curr.price !== undefined ? Number(curr.price) : null,
                        discount_percent: curr.discount_percent !== '' && curr.discount_percent !== null && curr.discount_percent !== undefined ? Number(curr.discount_percent) : null,
                        is_visible: true
                    });
                }
            }

            if (upserts.length > 0) {
                const { error } = await supabase.from('role_pricing').upsert(upserts, { onConflict: 'product_id, role' });
                if (error) throw error;
            }

            toast.success('B2B ціни збережено');
            fetchData(); // reload
        } catch (error: any) {
            toast.error('Помилка ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handlePricingChange = (productId: string, role: string, field: 'price' | 'discount_percent', value: string) => {
        const key = `${productId}_${role}`;
        setPricingMap(prev => {
            const entry = prev[key] || { product_id: productId, role };
            return {
                ...prev,
                [key]: { ...entry, [field]: value }
            };
        });
    };

    if (loading) return <p style={{ color: '#64748b' }}>Завантаження...</p>;

    const cardStyle = { backgroundColor: '#fff', borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', overflow: 'hidden' as const };
    const thStyle = { padding: '16px', textAlign: 'left' as const, fontSize: '14px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const, borderBottom: '1px solid #e2e8f0' };
    const tdStyle = { padding: '16px', borderBottom: '1px solid #f1f5f9' };
    const inputStyle = { width: '100%', padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '3px', fontSize: '14px', boxSizing: 'border-box' as const };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '3px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#263A99', display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <DollarSign color="#263A99" /> B2B Роздрібні Ціни та Знижки
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px', marginBottom: 0 }}>
                        Встановіть фіксовані ціни або <strong>відсоток знижки</strong> для фотографів і корпоративних клієнтів.
                    </p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ padding: '8px 24px', backgroundColor: '#263A99', color: 'white', fontWeight: 700, borderRadius: '3px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    <Save size={18} /> {saving ? 'Збереження...' : 'Зберегти зміни'}
                </button>
            </div>

            <div style={cardStyle}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f8fafc' }}>
                        <tr>
                            <th style={{ ...thStyle, width: '33%' }}>Товар</th>
                            <th style={{ ...thStyle, width: '33%', borderLeft: '1px solid #e2e8f0', color: '#1e40af', backgroundColor: '#eff6ff' }}>Photographer Role</th>
                            <th style={{ ...thStyle, width: '33%', borderLeft: '1px solid #e2e8f0', color: '#6b21a8', backgroundColor: '#faf5ff' }}>Corporate Role</th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map(product => {
                            const pKey = `${product.id}_photographer`;
                            const cKey = `${product.id}_corporate`;

                            const pData = pricingMap[pKey] || {};
                            const cData = pricingMap[cKey] || {};

                            return (
                                <tr key={product.id} style={{ transition: 'background-color 0.2s', cursor: 'default' }}>
                                    <td style={tdStyle}>
                                        <p style={{ fontWeight: 700, color: '#263A99', margin: '0 0 4px 0' }}>{product.name}</p>
                                        <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>Базова ціна: ₴{product.price}</p>
                                    </td>

                                    <td style={{ ...tdStyle, borderLeft: '1px solid #f1f5f9', backgroundColor: 'rgba(239, 246, 255, 0.3)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, width: '64px', color: '#64748b' }}>Ціна (₴):</span>
                                            <input
                                                type="number"
                                                placeholder="Власна ціна"
                                                style={inputStyle}
                                                value={pData.price || ''}
                                                onChange={(e) => handlePricingChange(product.id, 'photographer', 'price', e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, width: '64px', color: '#64748b' }}>Знижка (%):</span>
                                            <input
                                                type="number"
                                                placeholder="Авто-знижка"
                                                style={inputStyle}
                                                value={pData.discount_percent || ''}
                                                onChange={(e) => handlePricingChange(product.id, 'photographer', 'discount_percent', e.target.value)}
                                            />
                                        </div>
                                    </td>

                                    <td style={{ ...tdStyle, borderLeft: '1px solid #f1f5f9', backgroundColor: 'rgba(250, 245, 255, 0.3)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, width: '64px', color: '#64748b' }}>Ціна (₴):</span>
                                            <input
                                                type="number"
                                                placeholder="Власна ціна"
                                                style={inputStyle}
                                                value={cData.price || ''}
                                                onChange={(e) => handlePricingChange(product.id, 'corporate', 'price', e.target.value)}
                                            />
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600, width: '64px', color: '#64748b' }}>Знижка (%):</span>
                                            <input
                                                type="number"
                                                placeholder="Авто-знижка"
                                                style={inputStyle}
                                                value={cData.discount_percent || ''}
                                                onChange={(e) => handlePricingChange(product.id, 'corporate', 'discount_percent', e.target.value)}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
