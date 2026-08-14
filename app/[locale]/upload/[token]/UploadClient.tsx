'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * The page a customer opens from a link to send us photos.
 *
 * Built around the failure it exists to fix (Diana, 2026-08-14): eighteen
 * megabytes over mobile data. So files go up ONE AT A TIME, each with its own
 * state, and a file that fails gets a «Спробувати ще» button of its own —
 * nothing else in the queue is lost. No login, no app, nothing to install.
 */

type Row = {
    file: File;
    status: 'waiting' | 'sending' | 'done' | 'error';
    error?: string;
};

type LinkInfo = { orderNumber: string; customerName: string; uploads: number };

export default function UploadClient({ token }: { token: string }) {
    const [info, setInfo] = useState<LinkInfo | null>(null);
    const [invalid, setInvalid] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const busy = useRef(false);

    useEffect(() => {
        fetch(`/api/upload-link/${token}`)
            .then(r => (r.ok ? r.json() : Promise.reject(new Error('invalid'))))
            .then(d => setInfo({ orderNumber: d.orderNumber, customerName: d.customerName, uploads: d.uploads }))
            .catch(() => setInvalid(true));
    }, [token]);

    // A queue, not a loop over Promise.all: parallel uploads of large files on
    // a weak connection are exactly what fails.
    useEffect(() => {
        if (busy.current) return;
        const index = rows.findIndex(r => r.status === 'waiting');
        if (index < 0) return;

        busy.current = true;
        setRows(prev => prev.map((r, i) => (i === index ? { ...r, status: 'sending' } : r)));

        const body = new FormData();
        body.append('file', rows[index].file);

        fetch(`/api/upload-link/${token}`, { method: 'POST', body })
            .then(async res => {
                if (res.ok) return null;
                const data = await res.json().catch(() => ({}));
                const map: Record<string, string> = {
                    'too-big': 'Файл завеликий — понад 60 МБ',
                    'bad-type': 'Такий тип файлу ми не приймаємо',
                    'link-invalid': 'Посилання вже недійсне',
                };
                throw new Error(map[data?.error] || 'Не вдалося надіслати');
            })
            .then(() => {
                setRows(prev => prev.map((r, i) => (i === index ? { ...r, status: 'done' } : r)));
                setInfo(prev => (prev ? { ...prev, uploads: prev.uploads + 1 } : prev));
            })
            .catch(e => {
                setRows(prev => prev.map((r, i) => (i === index ? { ...r, status: 'error', error: e.message } : r)));
            })
            .finally(() => { busy.current = false; setRows(prev => [...prev]); });
    }, [rows, token]);

    const add = (files: FileList | null) => {
        if (!files?.length) return;
        setRows(prev => [...prev, ...Array.from(files).map(file => ({ file, status: 'waiting' as const }))]);
    };

    const retry = (index: number) => {
        setRows(prev => prev.map((r, i) => (i === index ? { ...r, status: 'waiting', error: undefined } : r)));
    };

    if (invalid) {
        return (
            <main className="mx-auto max-w-lg px-5 py-16 text-center">
                <AlertCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
                <h1 className="mb-2 text-xl font-semibold">Посилання недійсне</h1>
                <p className="text-gray-600">
                    Схоже, термін дії цього посилання минув. Напишіть нам, і ми надішлемо нове.
                </p>
            </main>
        );
    }

    const done = rows.filter(r => r.status === 'done').length;
    const failed = rows.filter(r => r.status === 'error').length;

    return (
        <main className="mx-auto max-w-lg px-5 py-10">
            <h1 className="mb-1 text-2xl font-semibold">Завантаження фото</h1>
            <p className="mb-6 text-gray-600">
                {info?.customerName ? `${info.customerName}, ц` : 'Ц'}е сторінка для вашого замовлення
                {info?.orderNumber ? ` ${info.orderNumber}` : ''}. Оберіть фото — вони підуть до нас по одному,
                тож навіть великі файли дійдуть без обривів.
            </p>

            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-gray-700 transition hover:border-gray-400 hover:bg-gray-100"
            >
                <Upload className="h-6 w-6" />
                <span className="font-medium">Обрати фото</span>
            </button>
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,video/mp4"
                className="hidden"
                onChange={e => { add(e.target.files); e.currentTarget.value = ''; }}
            />

            {rows.length > 0 && (
                <div className="space-y-2">
                    {rows.map((row, i) => (
                        <div key={`${row.file.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                            {row.status === 'done' && <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />}
                            {row.status === 'sending' && <Loader2 className="h-5 w-5 shrink-0 animate-spin text-blue-600" />}
                            {row.status === 'waiting' && <Upload className="h-5 w-5 shrink-0 text-gray-400" />}
                            {row.status === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />}

                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm">{row.file.name}</div>
                                <div className="text-xs text-gray-500">
                                    {(row.file.size / (1024 * 1024)).toFixed(1)} МБ
                                    {row.status === 'sending' && ' · надсилаємо'}
                                    {row.status === 'waiting' && ' · у черзі'}
                                    {row.status === 'error' && ` · ${row.error}`}
                                </div>
                            </div>

                            {row.status === 'error' && (
                                <button
                                    type="button"
                                    onClick={() => retry(i)}
                                    className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                                >
                                    <RefreshCw className="h-3 w-3" /> Ще раз
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {done > 0 && (
                <p className="mt-6 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                    Надіслано {done} {done === 1 ? 'файл' : 'файлів'} — ми вже їх бачимо.
                    {failed > 0 && ' Кілька не пройшли, натисніть «Ще раз» біля них.'}
                </p>
            )}
        </main>
    );
}
