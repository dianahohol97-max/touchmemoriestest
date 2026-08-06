'use client';

import { useState, useMemo } from 'react';

type FieldKey = 'email' | 'name' | 'phone' | 'last_order_at' | 'order_count' | 'total_spend';

const FIELD_LABELS: Record<FieldKey, string> = {
    email: 'Email (обовʼязково)',
    name: "Імʼя",
    phone: 'Телефон',
    last_order_at: 'Дата останнього замовлення',
    order_count: 'Кількість замовлень',
    total_spend: 'Сума всіх замовлень',
};

// Minimal CSV parser that respects quoted fields and a chosen delimiter.
function parseCSV(text: string, delimiter: string): string[][] {
    const rows: string[][] = [];
    let field = '';
    let row: string[] = [];
    let inQuotes = false;
    let i = 0;
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += c; i++; continue;
        }
        if (c === '"') { inQuotes = true; i++; continue; }
        if (c === delimiter) { row.push(field); field = ''; i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
        field += c; i++;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim() !== ''));
}

function detectDelimiter(firstLine: string): string {
    const semi = (firstLine.match(/;/g) || []).length;
    const comma = (firstLine.match(/,/g) || []).length;
    const tab = (firstLine.match(/\t/g) || []).length;
    if (tab > semi && tab > comma) return '\t';
    return semi > comma ? ';' : ',';
}

function toISODate(s: string): string {
    if (!s) return '';
    const v = s.trim();
    if (!v) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v;
    const m = v.match(/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d = new Date(v);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function guessField(header: string): FieldKey | '' {
    const h = header.toLowerCase();
    if (/(e-?mail|пошт|почт)/.test(h)) return 'email';
    if (/(phone|телефон|тел\b|моб)/.test(h)) return 'phone';
    if (/(остан|послед|last).*(замов|order|дат|date)|(дата.*замов)/.test(h)) return 'last_order_at';
    if (/(кільк|колич|count|orders|замовлен|заказов)/.test(h)) return 'order_count';
    if (/(сум|total|spend|витрат|выруч|amount|оборот)/.test(h)) return 'total_spend';
    if (/(імʼя|ім'я|имя|name|клієнт|клиент|client|пІб|піб)/.test(h)) return 'name';
    return '';
}

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, color: '#1e2d7d', background: '#fff',
};

type MergedContact = {
    email: string;
    name: string;
    phone: string;
    last_order_at: string;
    order_count: number;
    total_spend: number;
};

function csvEscape(value: string | number): string {
    const s = String(value ?? '');
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCSV(contacts: MergedContact[]): string {
    const header = ['email', 'name', 'phone', 'last_order_at', 'order_count', 'total_spend'];
    const lines = contacts.map(c => [
        c.email, c.name, c.phone, c.last_order_at,
        c.order_count || '', c.total_spend ? c.total_spend.toFixed(2) : '',
    ].map(csvEscape).join(','));
    return [header.join(','), ...lines].join('\n');
}

export default function CrmImportPage() {
    const [headers, setHeaders] = useState<string[]>([]);
    const [dataRows, setDataRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<Record<FieldKey, number>>({
        email: -1, name: -1, phone: -1, last_order_at: -1, order_count: -1, total_spend: -1,
    });
    const [source, setSource] = useState('keycrm');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ imported: number; received: number; subscribersAdded?: number; subscribersError?: string } | null>(null);
    const [error, setError] = useState('');
    const [addToSubscribers, setAddToSubscribers] = useState(false);

    // Direct pull from KeyCRM (skips the manual CSV export entirely).
    const [keycrmToken, setKeycrmToken] = useState('');
    const [withOrders, setWithOrders] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');
    const [syncError, setSyncError] = useState('');
    const [csvText, setCsvText] = useState('');

    const ingest = (text: string) => {
        setResult(null); setError('');
        const firstLine = text.split('\n')[0] || '';
        const delimiter = detectDelimiter(firstLine);
        const parsed = parseCSV(text, delimiter);
        if (parsed.length < 2) { setError('Файл порожній або лише заголовок'); return; }
        const hdr = parsed[0].map(h => h.trim());
        const rows = parsed.slice(1);
        const auto: Record<FieldKey, number> = { email: -1, name: -1, phone: -1, last_order_at: -1, order_count: -1, total_spend: -1 };
        hdr.forEach((h, idx) => {
            const f = guessField(h);
            if (f && auto[f] === -1) auto[f] = idx;
        });
        setHeaders(hdr); setDataRows(rows); setMapping(auto);
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => ingest(String(reader.result || ''));
        reader.readAsText(file, 'utf-8');
    };

    // Walk every page of a KeyCRM resource. The server route caps how many
    // pages one request may fetch and hands back `nextPage`, so the loop lives
    // here — that keeps each serverless invocation short no matter how many
    // thousands of records the CRM holds.
    const fetchAllPages = async (resource: 'buyer' | 'order', onProgress: (n: number, note?: string) => void) => {
        const collected: any[] = [];
        let page: number | null = 1;
        let guard = 0;

        while (page !== null && guard < 800) {
            let data: any = null;

            // A batch can die on the wire — KeyCRM's rate limit, a cold start,
            // a dropped connection. Retrying just this batch matters because
            // the alternative is throwing away every contact fetched so far and
            // starting the export from the first page again.
            for (let attempt = 0; attempt < 3 && !data; attempt++) {
                if (attempt > 0) {
                    onProgress(collected.length, `зʼєднання зірвалося, повторюю спробу ${attempt + 1} з 3`);
                    await new Promise(r => setTimeout(r, 4000 * attempt));
                }
                try {
                    const res = await fetch('/api/admin/crm-import/keycrm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: keycrmToken.trim() || undefined, resource, page, maxPages: 5 }),
                    });
                    const payload = await res.json();
                    if (!res.ok) throw new Error(payload?.error || 'Помилка запиту до KeyCRM');
                    data = payload;
                } catch (e: any) {
                    if (attempt === 2) {
                        if (collected.length > 0) {
                            // Keep what we have rather than losing the run; the
                            // caller reports the shortfall to the user.
                            onProgress(collected.length, 'завантаження обірвалося, працюю з тим, що вже зібрано');
                            return collected;
                        }
                        throw new Error(
                            e?.message === 'Failed to fetch'
                                ? 'Зʼєднання з сервером обірвалося ще на першій порції. Зачекай хвилину і спробуй ще раз — можливо, KeyCRM тимчасово обмежив частоту запитів.'
                                : (e?.message || 'Помилка запиту до KeyCRM'),
                        );
                    }
                }
            }

            collected.push(...(data.rows || []));
            onProgress(collected.length, data.warning ? 'KeyCRM пригальмовує, продовжую повільніше' : undefined);
            page = data.nextPage ?? null;
            guard++;
        }
        return collected;
    };

    const syncFromKeyCrm = async () => {
        setSyncing(true); setSyncError(''); setError(''); setResult(null); setCsvText('');
        try {
            const buyers = await fetchAllPages('buyer', (n, note) =>
                setSyncProgress(`Завантажую покупців із KeyCRM, уже отримано ${n} контактів${note ? ` — ${note}` : ''}.`));

            const merged = new Map<string, MergedContact>();
            for (const b of buyers) {
                const key = String(b.email || '').toLowerCase();
                if (!key) continue;
                const prev = merged.get(key);
                if (prev) {
                    if (!prev.name && b.name) prev.name = b.name;
                    if (!prev.phone && b.phone) prev.phone = b.phone;
                } else {
                    merged.set(key, {
                        email: key, name: b.name || '', phone: b.phone || '',
                        last_order_at: '', order_count: 0, total_spend: 0,
                    });
                }
            }

            if (withOrders) {
                const orders = await fetchAllPages('order', (n, note) =>
                    setSyncProgress(`Завантажую замовлення для дат і сум, уже оброблено ${n} записів${note ? ` — ${note}` : ''}.`));
                for (const o of orders) {
                    const key = String(o.email || '').toLowerCase();
                    if (!key) continue;
                    let entry = merged.get(key);
                    if (!entry) {
                        // Buyer was deleted from the CRM but the order still
                        // carries the email — keep the contact anyway.
                        entry = { email: key, name: o.name || '', phone: '', last_order_at: '', order_count: 0, total_spend: 0 };
                        merged.set(key, entry);
                    }
                    entry.order_count += 1;
                    entry.total_spend += Number(o.grand_total) || 0;
                    const iso = toISODate(String(o.created_at || ''));
                    if (iso && iso > entry.last_order_at) entry.last_order_at = iso;
                    if (!entry.name && o.name) entry.name = o.name;
                }
            }

            const contacts = Array.from(merged.values()).sort((a, b) => a.email.localeCompare(b.email));
            if (contacts.length === 0) {
                setSyncError('KeyCRM не повернув жодного контакту з email. Перевір, чи в покупців узагалі заповнене поле пошти.');
                setSyncProgress('');
                return;
            }
            const csv = toCSV(contacts);
            setCsvText(csv);
            ingest(csv);
            setSyncProgress(`Готово, зібрано ${contacts.length} унікальних email із KeyCRM. Перевір таблицю нижче та натисни кнопку імпорту.`);
        } catch (e: any) {
            setSyncError(e?.message || 'Не вдалося завантажити дані з KeyCRM');
            setSyncProgress('');
        } finally {
            setSyncing(false);
        }
    };

    const downloadCsv = () => {
        const blob = new Blob(['﻿' + csvText], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `keycrm-clients-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const builtRows = useMemo(() => {
        if (mapping.email < 0) return [];
        return dataRows.map(r => {
            const get = (k: FieldKey) => (mapping[k] >= 0 ? (r[mapping[k]] || '').trim() : '');
            return {
                email: get('email'),
                name: get('name'),
                phone: get('phone'),
                last_order_at: toISODate(get('last_order_at')),
                order_count: get('order_count'),
                total_spend: get('total_spend'),
            };
        }).filter(x => /.+@.+\..+/.test(x.email));
    }, [dataRows, mapping]);

    const doImport = async () => {
        if (builtRows.length === 0) return;
        setBusy(true); setError(''); setResult(null);
        try {
            const res = await fetch('/api/admin/crm-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: builtRows, source, addToSubscribers }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Помилка імпорту');
            setResult({
                imported: data.imported,
                received: data.received,
                subscribersAdded: data.subscribersAdded,
                subscribersError: data.subscribersError,
            });
        } catch (e: any) {
            setError(e?.message || 'Помилка імпорту');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 4px' }}>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#263A99', marginBottom: 6 }}>Імпорт клієнтів</h1>
            <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                Клієнтів можна підтягнути напряму з KeyCRM або завантажити CSV зі старої CRM вручну.
                Обовʼязковий лише email, решта колонок додається за бажанням.
                Імпортовані клієнти живлять автоматичний win-back (повертає тих, хто давно не замовляв)
                і не впливають на аналітику замовлень сайту.
            </p>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 700, color: '#263A99', marginBottom: 10, fontSize: 14 }}>1. Завантаження напряму з KeyCRM</label>
                <p style={{ color: '#64748b', fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
                    Ключ береться зі змінної оточення <code>KEYCRM_API_TOKEN</code>, якщо вона задана на Vercel.
                    Поки змінної немає, встав ключ у поле нижче — він піде тільки на наш сервер і ніде не зберігається.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                    <div>
                        <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>API-ключ KeyCRM</div>
                        <input
                            type="password"
                            value={keycrmToken}
                            onChange={e => setKeycrmToken(e.target.value)}
                            placeholder="залиш порожнім, якщо ключ уже в KEYCRM_API_TOKEN"
                            autoComplete="off"
                            style={inputStyle}
                        />
                    </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                    <input type="checkbox" checked={withOrders} onChange={e => setWithOrders(e.target.checked)} />
                    Підтягнути також замовлення, щоб отримати дати й суми (без них win-back не бачить, кому писати)
                </label>
                <div style={{ marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                        onClick={syncFromKeyCrm}
                        disabled={syncing}
                        style={{
                            padding: '12px 24px', background: syncing ? '#94a3b8' : '#263A99', color: '#fff',
                            border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                            cursor: syncing ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {syncing ? 'Завантажую…' : 'Завантажити клієнтів із KeyCRM'}
                    </button>
                    {csvText && (
                        <button
                            onClick={downloadCsv}
                            style={{
                                padding: '12px 24px', background: '#fff', color: '#263A99',
                                border: '1.5px solid #263A99', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            }}
                        >
                            Зберегти CSV собі
                        </button>
                    )}
                </div>
                {syncProgress && (
                    <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>{syncProgress}</div>
                )}
                {syncError && (
                    <div style={{ marginTop: 14, padding: 14, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 13 }}>
                        {syncError}
                    </div>
                )}
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 700, color: '#263A99', marginBottom: 10, fontSize: 14 }}>Або: CSV-файл</label>
                <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} style={{ fontSize: 14 }} />
            </div>

            {headers.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                    <label style={{ display: 'block', fontWeight: 700, color: '#263A99', marginBottom: 12, fontSize: 14 }}>2. Відповідність колонок</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {(Object.keys(FIELD_LABELS) as FieldKey[]).map(fk => (
                            <div key={fk}>
                                <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>{FIELD_LABELS[fk]}</div>
                                <select
                                    value={mapping[fk]}
                                    onChange={e => setMapping(m => ({ ...m, [fk]: Number(e.target.value) }))}
                                    style={inputStyle}
                                >
                                    <option value={-1}>— не використовувати —</option>
                                    {headers.map((h, idx) => (
                                        <option key={idx} value={idx}>{h || `Колонка ${idx + 1}`}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: 18, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div>
                            <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>Джерело (позначка)</div>
                            <input value={source} onChange={e => setSource(e.target.value)} style={{ ...inputStyle, width: 200 }} />
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b' }}>
                            Знайдено рядків з email: <strong style={{ color: '#263A99' }}>{builtRows.length}</strong> із {dataRows.length}
                        </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 16, fontSize: 13, color: '#475569', cursor: 'pointer', lineHeight: 1.5 }}>
                        <input
                            type="checkbox"
                            checked={addToSubscribers}
                            onChange={e => setAddToSubscribers(e.target.checked)}
                            style={{ marginTop: 3 }}
                        />
                        <span>
                            Додати цих людей у підписників, щоб їм можна було відправляти звичайну розсилку
                            через розділ «Листи». Без цієї галочки контакти живлять тільки автоматичний win-back.
                            Ті, хто вже відписався раніше, залишаються відписаними — їх ця дія не повертає.
                        </span>
                    </label>
                </div>
            )}

            {headers.length > 0 && mapping.email >= 0 && builtRows.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20, overflowX: 'auto' }}>
                    <label style={{ display: 'block', fontWeight: 700, color: '#263A99', marginBottom: 12, fontSize: 14 }}>3. Перевірка (перші 5)</label>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: '#94a3b8' }}>
                                <th style={{ padding: '6px 10px' }}>Email</th>
                                <th style={{ padding: '6px 10px' }}>Імʼя</th>
                                <th style={{ padding: '6px 10px' }}>Остання дата</th>
                                <th style={{ padding: '6px 10px' }}>К-сть</th>
                                <th style={{ padding: '6px 10px' }}>Сума</th>
                            </tr>
                        </thead>
                        <tbody>
                            {builtRows.slice(0, 5).map((r, idx) => (
                                <tr key={idx} style={{ borderTop: '1px solid #f1f5f9', color: '#1e2d7d' }}>
                                    <td style={{ padding: '6px 10px' }}>{r.email}</td>
                                    <td style={{ padding: '6px 10px' }}>{r.name || '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>{r.last_order_at || '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>{r.order_count || '—'}</td>
                                    <td style={{ padding: '6px 10px' }}>{r.total_spend || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {headers.length > 0 && (
                <button
                    onClick={doImport}
                    disabled={busy || builtRows.length === 0}
                    style={{
                        padding: '14px 28px', background: builtRows.length === 0 ? '#94a3b8' : '#263A99',
                        color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                        cursor: busy || builtRows.length === 0 ? 'not-allowed' : 'pointer',
                    }}
                >
                    {busy ? 'Імпортую…' : `Імпортувати ${builtRows.length} клієнтів`}
                </button>
            )}

            {result && (
                <div style={{ marginTop: 18, padding: 16, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, color: '#166534', fontSize: 14 }}>
                    Готово: збережено/оновлено <strong>{result.imported}</strong> клієнтів (отримано {result.received}).
                    Win-back підхопить тих, хто потрапляє у вікно 60–540 днів.
                    {typeof result.subscribersAdded === 'number' && result.subscribersAdded > 0 && (
                        <> Додано у підписників нових контактів: <strong>{result.subscribersAdded}</strong>, сегмент «{source}».</>
                    )}
                    {result.subscribersError && (
                        <div style={{ marginTop: 10, color: '#92400e' }}>
                            Клієнтів збережено, але додати їх у підписників не вдалося: {result.subscribersError}
                        </div>
                    )}
                </div>
            )}
            {error && (
                <div style={{ marginTop: 18, padding: 16, background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, color: '#991b1b', fontSize: 14 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
