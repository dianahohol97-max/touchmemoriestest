import type { PermissionLevel } from '@/lib/auth/permissions';

/**
 * Розділи адмінки — єдиний перелік, за яким живуть три речі одразу: меню
 * (app/admin/AdminLayout.tsx), серверні guard-и (requireSection) і сторінка
 * «Ролі та права».
 *
 * Доти цей перелік ніде не був записаний. Ролі в admin_roles уже містили
 * рівно ці десять ключів, меню зверталося до них по рядку, а сторінка ролей
 * показувала шість галочок, які перекладались у ці ключі туди й назад. Через
 * переклад редагувати можна було тільки шість розділів із десяти, і кожне
 * збереження було втратним: галочка «Може управляти продуктами» завжди
 * повертала catalog: 'edit', тож роль власника з catalog: 'full' після
 * першого ж «Зберегти» тихо ставала слабшою. Те саме з аналітикою, контентом
 * і фінансами, де переклад умів лише 'view'.
 *
 * Тепер перелік один і рівні виставляються прямо, без перекладу.
 */
export interface AdminSection {
    key: string;
    label: string;
    hint: string;
}

export const ADMIN_SECTIONS: AdminSection[] = [
    { key: 'orders', label: 'Замовлення', hint: 'Картки замовлень, статуси, ТТН, листи клієнту' },
    { key: 'production', label: 'Виробництво', hint: 'Дошка виробництва, кадрування, склад, календар' },
    { key: 'customers', label: 'Клієнти', hint: 'База покупців і CRM' },
    { key: 'catalog', label: 'Каталог', hint: 'Товари, категорії, колекції, партнери' },
    { key: 'content', label: 'Контент', hint: 'Блог, дизайн сайту, лендінги, відгуки' },
    { key: 'marketing', label: 'Маркетинг', hint: 'Промокоди, розсилки, ліди, продажі' },
    { key: 'analytics', label: 'Аналітика', hint: 'Огляд і звіти' },
    { key: 'finance', label: 'Фінанси', hint: 'Платежі, витрати, зарплати, рахунки' },
    { key: 'ai', label: 'AI та чат', hint: 'AI Inbox і налаштування чатбота' },
    { key: 'settings', label: 'Налаштування', hint: 'Команда, ролі, доставка, фіскалізація' },
];

export const ADMIN_SECTION_KEYS = new Set(ADMIN_SECTIONS.map(s => s.key));

/** Рівні в порядку зростання, з людськими підписами для сторінки ролей. */
export const PERMISSION_LEVELS: { value: PermissionLevel; label: string; hint: string }[] = [
    { value: 'none', label: 'Немає', hint: 'Розділ прихований і закритий' },
    { value: 'view', label: 'Перегляд', hint: 'Бачить, але не змінює' },
    { value: 'edit', label: 'Редагування', hint: 'Бачить і змінює' },
    { value: 'full', label: 'Повний', hint: 'Змінює і видаляє' },
];
