'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './GalleryClient.module.css';
import type { GalleryStrings } from '@/lib/photographers/gallery-i18n';
import {
  archiveName, partLimitFor, chooseZipMethod, detectZipDevice, formatBytes,
  partBytes, planZipParts, uniqueZipNames, type ZipDevice, type ZipMethod,
} from '@/lib/photographers/zip-plan';
import {
  canStreamToDisk, isAbort, pickZipTarget, zipToBlobDownload, zipToDisk,
  type ZipRunOptions, type ZipRunStats, type ZipSource,
} from '@/lib/photographers/zip-download';

interface PanelPhoto { id: string; file_name: string; size_bytes: number | null; url: string; media_type: 'photo' | 'video' }

interface Running {
  key: string;          // 'all' або номер частини
  done: number;
  total: number;
}

type Notice = 'done' | 'cancelled' | 'fellback' | 'error' | null;

interface AttemptMeta {
  method: ZipMethod;
  part_index?: number;
  parts_total?: number;
  files_total: number;
  bytes_total: number;
}

/**
 * Панель «Завантажити все» (Diana, 2026-09-24). Замість одного JSZip у
 * пам'яті — спосіб під пристрій (див. `lib/photographers/zip-plan.ts`):
 * Chrome/Edge на комп'ютері пишуть один архів прямо на диск, решта качає
 * частинами з відомою стелею. Кожна спроба йде в gallery_zip_attempts ДО
 * першого байта, тож впала вкладка лишає слід, а не нуль.
 */
export default function ZipPanel({ token, title, photos, t, onClose }: {
  token: string;
  title: string;
  photos: PanelPhoto[];
  t: GalleryStrings;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<ZipDevice>('desktop');
  const [streamOk, setStreamOk] = useState(false);
  const [ready, setReady] = useState(false);
  const [tryHere, setTryHere] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [doneParts, setDoneParts] = useState<Set<number>>(() => new Set());
  const [notice, setNotice] = useState<Notice>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Завершені частини — у ref, бо «усі частини готові» треба знати синхронно,
  // у ту ж мить, коли остання частина повідомляє про успіх.
  const doneRef = useRef<Set<number>>(new Set());
  const allReportedRef = useRef(false);
  const attemptRef = useRef<{ id: string; stats: ZipRunStats } | null>(null);

  useEffect(() => {
    setDevice(detectZipDevice(navigator.userAgent, navigator.maxTouchPoints || 0));
    setStreamOk(canStreamToDisk());
    setReady(true);
  }, []);

  const files: ZipSource[] = useMemo(() => {
    const names = uniqueZipNames(photos);
    return photos.map((p, i) => ({ id: p.id, name: names[i], size: p.size_bytes || 0, url: p.url }));
  }, [photos]);
  const totalBytes = useMemo(() => files.reduce((s, f) => s + f.size, 0), [files]);

  const method: ZipMethod = fallback
    ? 'parts'
    : chooseZipMethod({ device, canStreamToDisk: streamOk, totalBytes });
  const plan = useMemo(
    () => planZipParts(files, partLimitFor(device, fallback)),
    [files, device, fallback],
  );

  const size = (n: number) => formatBytes(n, t.sizeUnits, t.dateLocale);
  const base = `/api/gallery/${encodeURIComponent(token)}`;

  // Закрита вкладка посеред завантаження — не те саме, що вкладка, яку вбила
  // нестача пам'яті. Перше браузер ще встигає сказати beacon-ом; друге мовчить,
  // і рядок лишається без результату.
  useEffect(() => {
    const onHide = () => {
      const a = attemptRef.current;
      if (!a) return;
      navigator.sendBeacon?.(`${base}/zip-attempt`, JSON.stringify({
        action: 'finish', id: a.id, outcome: 'cancelled', files_via_proxy: a.stats.viaProxy, error: 'page_closed',
      }));
      attemptRef.current = null;
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, [base]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startAttempt = async (meta: AttemptMeta): Promise<string | null> => {
    try {
      const res = await fetch(`${base}/zip-attempt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', device, ...meta }),
      });
      const json = await res.json().catch(() => ({}));
      return res.ok && typeof json.id === 'string' ? json.id : null;
    } catch { return null; }
  };

  const finishAttempt = (id: string | null, body: Record<string, unknown>) => {
    if (!id) return;
    fetch(`${base}/zip-attempt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ action: 'finish', id, ...body }),
    }).catch(() => {});
  };

  /** Спільний цикл спроби: журнал → робота → результат у журнал. */
  const run = async (
    key: string,
    subset: ZipSource[],
    meta: AttemptMeta,
    work: (opts: ZipRunOptions) => Promise<ZipRunStats>,
    onSuccess: () => boolean, // повертає all_parts_done
  ) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const total = subset.reduce((s, f) => s + f.size, 0);
    setNotice(null);
    setRunning({ key, done: 0, total });
    const id = await startAttempt(meta);
    const stats: ZipRunStats = { viaProxy: 0 };
    if (id) attemptRef.current = { id, stats };

    let last = 0;
    const onProgress = (done: number) => {
      const now = Date.now();
      if (now - last < 200) return;
      last = now;
      setRunning(r => (r && r.key === key ? { ...r, done } : r));
    };
    try {
      const res = await work({ token, files: subset, signal: ctrl.signal, onProgress });
      stats.viaProxy = res.viaProxy;
      attemptRef.current = null;
      const allDone = onSuccess();
      finishAttempt(id, { outcome: 'completed', files_via_proxy: stats.viaProxy, all_parts_done: allDone });
      setNotice('done');
    } catch (e) {
      attemptRef.current = null;
      if (isAbort(e, ctrl.signal)) {
        finishAttempt(id, { outcome: 'cancelled', files_via_proxy: stats.viaProxy });
        setNotice('cancelled');
      } else {
        const err = e as any;
        finishAttempt(id, {
          outcome: 'failed', files_via_proxy: stats.viaProxy,
          error: `${err?.name || 'Error'}: ${String(err?.message || '').slice(0, 120)}`,
        });
        // Цілий архів не вийшов — частини з відомою стелею. Частина не вийшла —
        // лишаємо частини і просимо спробувати ще раз.
        if (meta.method !== 'parts') { setFallback(true); setNotice('fellback'); } else setNotice('error');
      }
    } finally {
      abortRef.current = null;
      setRunning(null);
    }
  };

  const startWhole = async () => {
    if (running) return;
    const name = archiveName(title);
    // Діалог «Зберегти як» — першим ділом, поки жест людини ще живий.
    if (method === 'stream') {
      let handle: any = null;
      try { handle = await pickZipTarget(name); } catch { setFallback(true); setNotice('fellback'); return; }
      if (!handle) return;
      await run('all', files, { method: 'stream', files_total: files.length, bytes_total: totalBytes },
        opts => zipToDisk(handle, opts), () => true);
      return;
    }
    await run('all', files, { method: 'single', files_total: files.length, bytes_total: totalBytes },
      opts => zipToBlobDownload(name, opts), () => true);
  };

  const startPart = async (index: number) => {
    if (running) return;
    const part = plan.parts[index];
    const label = t.zipPart(index + 1, plan.parts.length);
    const bytes = part.reduce((s, f) => s + f.size, 0);
    await run(String(index), part, {
      method: 'parts', part_index: index + 1, parts_total: plan.parts.length, files_total: part.length, bytes_total: bytes,
    }, opts => zipToBlobDownload(archiveName(title, plan.parts.length > 1 ? label : undefined), opts), () => {
      doneRef.current.add(index);
      setDoneParts(new Set(doneRef.current));
      // Повний набір рахується в zip_downloads один раз, а не щоразу, коли
      // людина перекачує якусь частину вже після того.
      if (allReportedRef.current || doneRef.current.size !== plan.parts.length) return false;
      allReportedRef.current = true;
      return true;
    });
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
    catch { window.prompt(t.copyLink, window.location.href); }
  };

  const pct = running && running.total > 0 ? Math.min(100, Math.round((running.done / running.total) * 100)) : 0;
  const progress = running && (
    <div className={styles.zipProgress}>
      <div className={styles.zipBar}><div className={styles.zipBarFill} style={{ width: `${pct}%` }} /></div>
      <div className={styles.zipProgressRow}>
        <span>{size(running.done)} / {size(running.total)}</span>
        <button type="button" className={styles.zipCancel} onClick={() => abortRef.current?.abort()}>{t.zipCancel}</button>
      </div>
    </div>
  );

  const showInApp = device === 'in-app' && !tryHere;

  return (
    <div className={styles.zipOverlay} role="dialog" aria-modal="true" aria-label={t.zipTitle}
      onClick={e => { if (e.target === e.currentTarget && !running) onClose(); }}>
      <div className={styles.zipCard}>
        <div className={styles.zipHead}>
          <div>
            <div className={styles.zipTitle}>{t.zipTitle}</div>
            <div className={styles.zipMeta}>{t.zipFiles(files.length, size(totalBytes))}</div>
          </div>
          <button type="button" className={styles.zipClose} onClick={onClose} disabled={!!running} aria-label={t.ariaClose}>×</button>
        </div>

        {!ready ? null : showInApp ? (
          <>
            <p className={styles.zipNote}>{t.inAppNote}</p>
            <div className={styles.zipActions}>
              <button type="button" className={styles.downloadBtn} onClick={copyLink}>
                {copied ? t.linkCopied : t.copyLink}
              </button>
              <button type="button" className={styles.zipGhost} onClick={() => setTryHere(true)}>{t.tryHere}</button>
            </div>
          </>
        ) : (
          <>
            {notice === 'fellback' && <p className={styles.zipWarn}>{t.zipFellBack}</p>}
            {notice === 'error' && <p className={styles.zipWarn}>{t.zipError}</p>}
            {notice === 'cancelled' && <p className={styles.zipNote}>{t.zipCancelled}</p>}
            {notice === 'done' && method !== 'parts' && <p className={styles.zipOk}>{t.zipDone}</p>}

            {method !== 'parts' ? (
              <>
                <p className={styles.zipNote}>{method === 'stream' ? t.zipStreamNote : t.zipSingleNote}</p>
                {running ? progress : (
                  <div className={styles.zipActions}>
                    <button type="button" className={styles.downloadBtn} onClick={startWhole}>{t.zipStart}</button>
                  </div>
                )}
              </>
            ) : (
              <>
                <p className={styles.zipNote}>{t.zipPartsNote}</p>
                <div className={styles.zipParts}>
                  {plan.parts.map((part, i) => {
                    const isRunning = running?.key === String(i);
                    return (
                      <div key={i} className={styles.zipPartRow}>
                        <button type="button" className={doneParts.has(i) ? styles.zipGhost : styles.downloadBtn}
                          onClick={() => startPart(i)} disabled={!!running}>
                          {doneParts.has(i) ? '✓ ' : ''}{t.zipPart(i + 1, plan.parts.length)}
                        </button>
                        <span className={styles.zipMeta}>{t.zipFiles(part.length, size(partBytes(part)))}</span>
                        {isRunning && progress}
                      </div>
                    );
                  })}
                </div>
                {plan.separate.length > 0 && (
                  <>
                    <p className={styles.zipNote}>{t.zipSeparateNote}</p>
                    <ul className={styles.zipSeparate}>
                      {plan.separate.map(f => (
                        <li key={f.id}>
                          <a href={`${base}/file/${encodeURIComponent(f.id)}`} className={styles.zipLink}>{f.name}</a>
                          <span className={styles.zipMeta}> · {size(f.size)}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}

            {device === 'ios' && <p className={styles.zipSmall}>{t.iosFilesNote}</p>}
            <p className={styles.zipSmall}>{t.oneByOneNote}</p>
          </>
        )}
      </div>
    </div>
  );
}
