'use client';
import { useState, useEffect, useCallback } from 'react';
import { Link2, Loader2, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Catalogue reconciliation: which KeyCRM item each website product actually is.
 *
 * The matcher proposes, a person confirms — and only confirmed pairs are used
 * anywhere. Order lines attach to the CRM catalogue through them, purchase
 * costs and stock levels travel only along them. A wrong link moves another
 * product's stock and poisons the reports, which is why nothing here is ever
 * auto-confirmed, however high the score.
 */

export default function KeycrmCataloguePage() {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/keycrm/catalogue', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося завантажити звірку');
            setReport(json);
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося завантажити звірку');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const confirmRows = async (rows: any[], label: string) => {
        if (!rows.length) return;
        setSaving(label);
        try {
            const res = await fetch('/api/admin/keycrm/catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rows: rows.map(r => ({
                        site_slug: r.site_slug,
                        site_variant: r.site_variant,
                        site_variant_label: r.site_variant_label,
                        site_product_name: r.site_product_name,
                        keycrm_offer_id: r.keycrm_offer_id,
                        keycrm_sku: r.keycrm_sku,
                        keycrm_name: r.keycrm_name,
                        match_type: r.match_type,
                        match_score: r.match_score,
                        confirmed: true,
                    })),
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося зберегти');
            toast.success(`Підтверджено: ${json.saved}`);
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося зберегти');
        } finally {
            setSaving(null);
        }
    };

    const rows: any[] = report?.rows || [];
    const strong = rows.filter(r => !r.confirmed && (r.match_score ?? 0) >= 0.8 && !r.ambiguous_with && r.keycrm_offer_id);
    const weak = rows.filter(r => !r.confirmed && r.keycrm_offer_id && !strong.includes(r));
    const unmatched = rows.filter(r => !r.confirmed && !r.keycrm_offer_id);
    const confirmed = rows.filter(r => r.confirmed);

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Link2 size={24} style={{ color: '#263a99' }} />
                    <div>
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#0f172a' }}>Звірка товарів із KeyCRM</h1>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                            Підтверджені пари: {confirmed.length}. Лише по них їдуть позиції замовлень, собівартість і залишки.
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={load} style={secondaryBtn}><RefreshCw size={14} /> Оновити</button>
                    {strong.length > 0 && (
                        <button onClick={() => confirmRows(strong, 'bulk')} disabled={saving !== null} style={primaryBtn}>
                            {saving === 'bulk' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            Підтвердити всі впевнені ({strong.length})
                        </button>
                    )}
                </div>
            </div>

            {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: '#64748b' }}>
                    <Loader2 size={18} className="animate-spin" /> Читаю обидва каталоги, це кілька секунд
                </div>
            )}

            {!loading && report && (
                <>
                    <Section title={`Впевнені збіги — ${strong.length}`} hint="Слова назв збігаються майже повністю і на цю позицію CRM не претендує інший товар. Перевір оком і підтверджуй.">
                        {strong.map(r => <Row key={rowKey(r)} row={r} onConfirm={() => confirmRows([r], rowKey(r))} saving={saving === rowKey(r)} />)}
                    </Section>

                    <Section title={`Потребують уваги — ${weak.length}`} hint="Оцінка нижча, або на ту саму позицію CRM претендує кілька товарів сайту. Дивись уважно перед підтвердженням.">
                        {weak.map(r => <Row key={rowKey(r)} row={r} onConfirm={() => confirmRows([r], rowKey(r))} saving={saving === rowKey(r)} />)}
                    </Section>

                    <Section title={`Не знайдено в CRM — ${unmatched.length}`} hint="Для цих товарів відповідника не запропоновано. Або їх немає в номенклатурі CRM, або назви занадто різні — заведи товар у CRM чи напиши мені, як він там називається.">
                        {unmatched.map(r => (
                            <div key={rowKey(r)} style={{ ...rowStyle, color: '#64748b' }}>
                                {r.site_product_name}
                            </div>
                        ))}
                    </Section>

                    {confirmed.length > 0 && (
                        <Section title={`Підтверджені — ${confirmed.length}`} hint="">
                            {confirmed.map(r => (
                                <div key={rowKey(r)} style={{ ...rowStyle, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                                    <span style={{ fontWeight: 700 }}>{r.site_product_name}</span>
                                    <span style={{ color: '#15803d' }}>→ {r.keycrm_name}</span>
                                </div>
                            ))}
                        </Section>
                    )}
                </>
            )}
        </div>
    );
}

function rowKey(r: any) { return `${r.site_slug}::${r.site_variant || ''}`; }

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
    const items = Array.isArray(children) ? children : [children];
    if (!items.length || (Array.isArray(children) && children.length === 0)) return null;
    return (
        <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{title}</h2>
            {hint && <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, maxWidth: 640, lineHeight: 1.5 }}>{hint}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
        </div>
    );
}

function Row({ row, onConfirm, saving }: { row: any; onConfirm: () => void; saving: boolean }) {
    return (
        <div style={rowStyle}>
            <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{row.site_product_name}</div>
                <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                    → {row.keycrm_name} <span style={{ color: '#94a3b8' }}>({Math.round((row.match_score ?? 0) * 100)}%)</span>
                </div>
                {row.ambiguous_with?.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#c2410c', marginTop: 4 }}>
                        <AlertTriangle size={12} />
                        На цю ж позицію претендують: {row.ambiguous_with.join(', ')}
                    </div>
                )}
                {row.alternatives?.length > 0 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                        Інші варіанти: {row.alternatives.map((a: any) => `${a.keycrm_name} (${Math.round(a.score * 100)}%)`).join(', ')}
                    </div>
                )}
            </div>
            <button onClick={onConfirm} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Це той самий товар
            </button>
        </div>
    );
}

const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 16px',
};

const primaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#263a99', color: 'white', border: 'none', borderRadius: 8,
    padding: '9px 14px', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
};

const secondaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'white', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
