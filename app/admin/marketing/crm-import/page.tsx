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

export default function CrmImportPage() {
    const [headers, setHeaders] = useState<string[]>([]);
    const [dataRows, setDataRows] = useState<string[][]>([]);
    const [mapping, setMapping] = useState<Record<FieldKey, number>>({
        email: -1, name: -1, phone: -1, last_order_at: -1, order_count: -1, total_spend: -1,
    });
    const [source, setSource] = useState('keycrm');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<{ imported: number; received: number } | null>(null);
    const [error, setError] = useState('');

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
                body: JSON.stringify({ rows: builtRows, source }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Помилка імпорту');
            setResult({ imported: data.imported, received: data.received });
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
                Завантаж CSV зі старої CRM. Потрібен лише email; решта колонок — за бажанням.
                Імпортовані клієнти живлять автоматичний win-back (повертає тих, хто давно не замовляв)
                і не впливають на аналітику замовлень сайту.
            </p>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 24, marginBottom: 20 }}>
                <label style={{ display: 'block', fontWeight: 700, color: '#263A99', marginBottom: 10, fontSize: 14 }}>1. CSV-файл</label>
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
