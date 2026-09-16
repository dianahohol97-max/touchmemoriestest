'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GALLERY_POLL_MS, type WeddingPhoto } from '@/lib/wedding/config';

// Стан галереї: перше завантаження, догортування вниз і опитування про нові.
//
// Винесено з компонента, бо тут єдине неочевидне місце всієї сторінки —
// узгодження трьох джерел, які додають фото в один список: перша сторінка,
// кнопка «показати ще» і опитування раз на п'ятнадцять секунд. Плюс четверте:
// власне фото гостя, яке з'являється одразу після відправки, ще до того, як
// опитування про нього дізнається.

interface State {
  photos: WeddingPhoto[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  failed: boolean;
}

export function useWeddingPhotos(slug: string) {
  const [state, setState] = useState<State>({
    photos: [],
    loading: true,
    hasMore: false,
    loadingMore: false,
    failed: false,
  });

  // Курсор найновішого відомого фото. Живе в ref, а не в стані: опитування
  // читає його з таймера, і якби він був у стані, замикання в setInterval
  // назавжди запам'ятало б найперше значення.
  const newestRef = useRef<string | null>(null);
  const oldestRef = useRef<string | null>(null);

  /**
   * Додає фото в список, прибираючи повтори за id.
   *
   * Повтори тут неминучі, і це не помилка: гість бачить власне фото одразу
   * після відправки, а за кілька секунд те саме фото приносить опитування.
   * Без цієї перевірки воно стояло б у сітці двічі.
   *
   * Курсори зсуваються ТУТЕ, поза setState, і це важливо. Оновлювач стану має
   * бути чистим: React має право викликати його двічі на одне оновлення (саме
   * так поводиться StrictMode у розробці), і запис у ref усередині нього
   * виконався б теж двічі. Дані для курсорів беруться з відповіді сервера, де
   * порядок відомий — фото приходять найновішими вперед.
   */
  const merge = useCallback((incoming: WeddingPhoto[], position: 'start' | 'end') => {
    if (!incoming.length) return;

    if (position === 'start') {
      const newest = incoming[0].created_at;
      if (!newestRef.current || newest > newestRef.current) newestRef.current = newest;
    } else {
      const oldest = incoming[incoming.length - 1].created_at;
      if (!oldestRef.current || oldest < oldestRef.current) oldestRef.current = oldest;
      // Перша сторінка задає обидва краї: до неї відомого найновішого немає.
      if (!newestRef.current) newestRef.current = incoming[0].created_at;
    }

    setState((prev) => {
      const known = new Set(prev.photos.map((p) => p.id));
      const fresh = incoming.filter((p) => !known.has(p.id));
      if (!fresh.length) return prev;
      return {
        ...prev,
        photos: position === 'start' ? [...fresh, ...prev.photos] : [...prev.photos, ...fresh],
      };
    });
  }, []);

  const fetchPage = useCallback(
    async (query: string, signal?: AbortSignal) => {
      const res = await fetch(`/api/wedding/${slug}/photos${query}`, { signal, cache: 'no-store' });
      if (!res.ok) throw new Error(`photos ${res.status}`);
      return (await res.json()) as { photos: WeddingPhoto[]; hasMore: boolean };
    },
    [slug]
  );

  // Перше завантаження.
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const data = await fetchPage('', controller.signal);
        if (controller.signal.aborted) return;
        merge(data.photos, 'end');
        setState((prev) => ({ ...prev, loading: false, hasMore: data.hasMore, failed: false }));
      } catch {
        if (controller.signal.aborted) return;
        // Сітка лишається порожньою, але сторінка працює: завантажити фото це
        // не заважає, а наступне опитування спробує ще раз.
        setState((prev) => ({ ...prev, loading: false, failed: true }));
      }
    })();
    return () => controller.abort();
  }, [fetchPage, merge]);

  // Опитування про нові фото.
  useEffect(() => {
    const controller = new AbortController();

    const poll = async () => {
      if (document.hidden) return; // Вкладка згорнута — гість нічого не бачить.
      const after = newestRef.current;
      if (!after) return; // Ще нічого не завантажилося, курсора немає.

      try {
        // Сплеск більший за сторінку сервер віддає з кінця, найстарішими з
        // нових, і каже hasMore. Дочитуємо тут же, щоб не чекати наступних
        // п'ятнадцяти секунд: на танцях таких сплесків буває кілька поспіль.
        //
        // Курсор ведемо змінною, а не перечитуємо ref щоразу: merge оновлює
        // його синхронно, але стан React застосовує відкладено, і покладатися
        // всередині циклу на те, що вже все записалося, не варто. Відповідь
        // приходить найновішими вперед, тож наступний курсор — перший елемент.
        let cursor: string | null = after;
        for (let guard = 0; guard < 10 && cursor; guard++) {
          const data = await fetchPage(`?after=${encodeURIComponent(cursor)}`, controller.signal);
          if (controller.signal.aborted) return;
          if (!data.photos.length) break;
          merge(data.photos, 'start');
          cursor = data.photos[0].created_at;
          if (!data.hasMore) break;
        }
        setState((prev) => (prev.failed ? { ...prev, failed: false } : prev));
      } catch {
        // Мережа на весіллі відпадає регулярно. Мовчимо і пробуємо наступного
        // разу — показувати гостю помилку за кожен збій опитування немає сенсу.
      }
    };

    const timer = setInterval(poll, GALLERY_POLL_MS);
    // Гість повернувся у вкладку — показуємо свіже, не чекаючи таймера.
    document.addEventListener('visibilitychange', poll);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [fetchPage, merge]);

  const loadMore = useCallback(async () => {
    const before = oldestRef.current;
    if (!before) return;
    setState((prev) => ({ ...prev, loadingMore: true }));
    try {
      const data = await fetchPage(`?before=${encodeURIComponent(before)}`);
      merge(data.photos, 'end');
      setState((prev) => ({ ...prev, loadingMore: false, hasMore: data.hasMore }));
    } catch {
      setState((prev) => ({ ...prev, loadingMore: false }));
    }
  }, [fetchPage, merge]);

  /** Щойно надіслане фото — у сітку негайно, не чекаючи опитування. */
  const addOwn = useCallback((photo: WeddingPhoto) => merge([photo], 'start'), [merge]);

  return { ...state, loadMore, addOwn };
}
