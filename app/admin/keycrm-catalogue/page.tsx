'use client';
import { useState, useEffect, useCallback } from 'react';
import { Link2, Loader2, Check, RefreshCw, AlertTriangle, PenLine } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Catalogue reconciliation: which KeyCRM item each website product actually is.
 *
 * The matcher proposes, a person confirms — and only confirmed pairs are used
 * anywhere. Order lines attach to the CRM catalogue through them, purchase
 * costs and stock levels travel only along them. A wrong link moves another
 * product's stock and poisons the reports, which is why nothing here is ever
 * auto-confirmed, however high the score.
 *
 * Access is any active staff member, not admin-only: Diana handed this work to
 * the project manager, and matching names is exactly the judgement a person who
 * handles orders daily is best placed to make.
 *
 * When the matcher has nothing (or the wrong thing), a row can be resolved by
 * hand: paste the product's link or id from KeyCRM and, in words, explain what
 * is what. The explanation is stored with the row and survives re-runs, so a
 * half-finished reconciliation resumes where it stopped.
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

    const postRows = async (rows: any[], label: string, successMsg: string) => {
        setSaving(label);
        try {
            const res = await fetch('/api/admin/keycrm/catalogue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося зберегти');
            if (Array.isArray(json.warnings) && json.warnings.length) {
                json.warnings.forEach((w: string) => toast.error(w, { duration: 9000 }));
            } else {
                toast.success(successMsg);
            }
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося зберегти');
        } finally {
            setSaving(null);
        }
    };

    const confirmRows = (rows: any[], label: string) => postRows(
        rows.map(r => ({
            site_slug: r.site_slug,
            site_variant: r.site_variant,
            site_variant_label: r.site_variant_label,
            site_product_name: r.site_product_name,
            keycrm_offer_id: r.keycrm_offer_id,
            keycrm_sku: r.keycrm_sku,
            keycrm_name: r.keycrm_name,
            match_type: r.match_type,
            match_score: r.match_score,
            note: r.note ?? null,
            confirmed: true,
        })),
        label,
        `Підтверджено: ${rows.length}`,
    );

    /**
     * Manual resolution. A pasted KeyCRM link ends in the item's number, so the
     * LAST run of digits is the id — "…/products/1234" and a bare "1234" both
     * work. With an id the pair is confirmed as manual; without one only the
     * explanation is stored, unconfirmed, so nothing links to a guess.
     */
    const saveManual = (row: any, fields: { link: string; note: string }) => {
        const digits = (fields.link.match(/\d+/g) || []).pop() || '';

        return postRows(
            [{
                site_slug: row.site_slug,
                site_variant: row.site_variant,
                site_variant_label: row.site_variant_label,
                site_product_name: row.site_product_name,
                keycrm_offer_id: digits || row.keycrm_offer_id || null,
                keycrm_sku: row.keycrm_sku ?? null,
                keycrm_name: digits ? `KeyCRM #${digits}` : row.keycrm_name,
                match_type: digits ? 'manual' : row.match_type,
                match_score: digits ? null : row.match_score,
                note: fields.note.trim() || null,
                confirmed: Boolean(digits),
            }],
            rowKey(row),
            digits ? 'Звʼязано вручну.' : 'Пояснення збережено — звʼязку поки немає.',
        );
    };

    /**
     * SKUs are the only thing KeyCRM's order API links catalogue items by —
     * the offer_id sent alongside is ignored. This writes the site slug as the
     * article number for every confirmed pair whose CRM offer has none, after
     * which pushed order lines attach to the real catalogue items.
     */
    const syncSkus = async () => {
        setSaving('skus');
        try {
            const res = await fetch('/api/admin/keycrm/skus?apply=1', { cache: 'no-store' });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || 'Не вдалося записати артикули');
            const filled = json.filled?.length || 0;
            const adopted = json.adopted?.length || 0;
            toast.success(`Артикули: записано в KeyCRM ${filled}, підхоплено наявних ${adopted}.`, { duration: 7000 });
            if (Array.isArray(json.problems)) json.problems.forEach((p: string) => toast.error(p, { duration: 9000 }));
        } catch (e: any) {
            toast.error(e?.message || 'Не вдалося записати артикули');
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
                    {confirmed.length > 0 && (
                        <button onClick={syncSkus} disabled={saving !== null} style={secondaryBtn} title="Записати артикули підтверджених пар у KeyCRM, щоб позиції замовлень чіплялися до каталогу">
                            {saving === 'skus' ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                            Проставити артикули в KeyCRM
                        </button>
                    )}
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
                        {strong.map(r => (
                            <Row key={rowKey(r)} row={r}
                                onConfirm={() => confirmRows([r], rowKey(r))}
                                onManual={fields => saveManual(r, fields)}
                                saving={saving === rowKey(r)} />
                        ))}
                    </Section>

                    <Section title={`Потребують уваги — ${weak.length}`} hint="Оцінка нижча, або на ту саму позицію CRM претендує кілька товарів сайту. Якщо пропозиція неправильна, розгорни «Вказати вручну» і встав посилання на правильний товар із KeyCRM.">
                        {weak.map(r => (
                            <Row key={rowKey(r)} row={r}
                                onConfirm={() => confirmRows([r], rowKey(r))}
                                onManual={fields => saveManual(r, fields)}
                                saving={saving === rowKey(r)} />
                        ))}
                    </Section>

                    <Section title={`Не знайдено в CRM — ${unmatched.length}`} hint="Відповідника не запропоновано. Відкрий товар у KeyCRM, скопіюй посилання з адресного рядка і встав сюди — цього достатньо, щоб звʼязати. Пояснення словами теж зберігається.">
                        {unmatched.map(r => (
                            <Row key={rowKey(r)} row={r}
                                onManual={fields => saveManual(r, fields)}
                                saving={saving === rowKey(r)}
                                manualOpenByDefault />
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
    if (Array.isArray(children) && children.length === 0) return null;
    return (
        <div style={{ marginBottom: 26 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>{title}</h2>
            {hint && <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10, maxWidth: 680, lineHeight: 1.5 }}>{hint}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
        </div>
    );
}

function Row({ row, onConfirm, onManual, saving, manualOpenByDefault }: {
    row: any;
    onConfirm?: () => void;
    onManual: (fields: { link: string; note: string }) => void;
    saving: boolean;
    manualOpenByDefault?: boolean;
}) {
    const [manualOpen, setManualOpen] = useState(Boolean(manualOpenByDefault));
    const [link, setLink] = useState('');
    const [note, setNote] = useState(row.note || '');

    return (
        <div style={rowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{row.site_product_name}</div>
                    {row.keycrm_name ? (
                        <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                            → {row.keycrm_name}
                            {row.match_score !== null && <span style={{ color: '#94a3b8' }}> ({Math.round((row.match_score ?? 0) * 100)}%)</span>}
                        </div>
                    ) : (
                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>Відповідника в CRM не знайдено</div>
                    )}
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
                    {row.note && !manualOpen && (
                        <div style={{ fontSize: 12, color: '#7c3aed', marginTop: 4 }}>Нотатка: {row.note}</div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setManualOpen(v => !v)} style={secondaryBtn} title="Вказати товар вручну">
                        <PenLine size={14} /> Вказати вручну
                    </button>
                    {onConfirm && row.keycrm_offer_id && (
                        <button onClick={onConfirm} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Це той самий товар
                        </button>
                    )}
                </div>
            </div>

            {manualOpen && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, paddingTop: 12, borderTop: '1px dashed #e2e8f0' }}>
                    <input
                        placeholder="Посилання на товар у KeyCRM або його номер"
                        value={link}
                        onChange={e => setLink(e.target.value)}
                        style={inputStyle}
                    />
                    <textarea
                        placeholder="Пояснення словами: де цей товар у CRM, як називається, на що звернути увагу…"
                        value={note}
                        onChange={e => setNote(e.target.value)}
                        rows={2}
                        style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button onClick={() => onManual({ link, note })} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.7 : 1 }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            {link.trim() ? 'Звʼязати і підтвердити' : 'Зберегти пояснення'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const rowStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column',
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
    padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
};

const inputStyle: React.CSSProperties = {
    border: '1px solid #e2e8f0', borderRadius: 8, padding: '9px 12px',
    fontSize: 13.5, color: '#0f172a', width: '100%', boxSizing: 'border-box',
};
