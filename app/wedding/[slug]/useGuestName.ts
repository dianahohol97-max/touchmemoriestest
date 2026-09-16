"use client";

import { useEffect, useState } from "react";

// Імʼя гостя — одне на всю сторінку.
//
// Блоки завантаження стоять поруч, двома колонками, і в кожного своє поле для
// підпису. Якби кожен тримав власний стан, поруч показувалися б два різні
// значення: людина вписала імʼя ліворуч, а праворуч і далі порожньо. Тому стан
// живе тут, а обидва поля лише дивляться в нього.
//
// Пам'ять браузера потрібна з тієї ж причини, з якої й раніше: гість
// повертається за вечір кілька разів, і щоразу підписуватися нудно.

const STORAGE_KEY = "wedding-guest-name";

export function useGuestName() {
  const [guestName, setGuestName] = useState("");

  // ЧОМУ ЧИТАЄМО В ЕФЕКТІ, А НЕ ПРИ СТВОРЕННІ СТАНУ. Компонент рендериться і на
  // сервері теж, а localStorage там немає. Якби початкове значення бралося
  // одразу, сервер віддав би порожнє поле, клієнт на першому ж рендері —
  // збережене імʼя, і React поскаржився б на розбіжність. Ефект виконується вже
  // після того, як розмітка збіглася.
  //
  // Правило react-hooks/set-state-in-effect береже від нескінченних циклів; тут
  // залежностей немає, тож виклик стається рівно один раз за монтування.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setGuestName(saved);
    } catch {
      // Приватний режим або заблоковані дані сайту. Поле лишиться порожнім.
    }
  }, []);

  useEffect(() => {
    try {
      if (guestName.trim()) localStorage.setItem(STORAGE_KEY, guestName.trim());
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Без пам'яті браузера все працює, просто імʼя не переживе перезавантаження.
    }
  }, [guestName]);

  return { guestName, setGuestName };
}
