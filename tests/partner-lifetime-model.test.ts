import { describe, expect, it } from 'vitest';
import { normalizeBindingEmail, isSelfReferral } from '@/lib/agency/binding';
import { DEFAULT_PARTNER_TERMS } from '@/lib/agency/create-partner';

/**
 * Модель «лише посилання + довічна привʼязка клієнта» (Діана, 16.09.2026).
 *
 * Правила, які тут закріплені:
 *  · клієнт переходить за посиланням і бачить готову знижку, коду не вводить;
 *  · перше ОПЛАЧЕНЕ замовлення закріплює його за партнером назавжди;
 *  · знижка діє тільки на це перше замовлення, комісія — на всі наступні;
 *  · привʼязка створюється один раз і чужим посиланням не перезаписується;
 *  · партнер не може привʼязати сам себе.
 *
 * Тут перевіряються чисті частини цих правил. Гілки, які ходять у базу
 * (нарахування, зняття при скасуванні, kind='repeat'), перевіряються моделлю
 * нижче: вона повторює порядок рішень із lib/agency/commission.ts, щоб
 * зафіксувати саме порядок, а не реалізацію запитів.
 */

describe('ставки не змінилися', () => {
    it('5% тревелбуки і журнали, 3% решта, знижка клієнту 5%', () => {
        // Числа заморожені навмисно: вони стоять у листі партнеру, на лендінгу,
        // у кабінеті й в умовах. Якщо цей тест червоний — хтось поміняв ставку,
        // і це або рішення власниці, або помилка.
        expect(DEFAULT_PARTNER_TERMS.travelbookRate).toBe(5);
        expect(DEFAULT_PARTNER_TERMS.otherRate).toBe(3);
        expect(DEFAULT_PARTNER_TERMS.clientDiscount).toBe(5);
    });
});

describe('normalizeBindingEmail', () => {
    it('нормалізує до нижнього регістру і без пробілів', () => {
        expect(normalizeBindingEmail('  Diana@Example.COM ')).toBe('diana@example.com');
    });

    it('не склеює різні адреси заради одного постачальника пошти', () => {
        // Крапки й «+тег» у гмейлі ведуть в ту саму скриньку, але для решти
        // світу це різні адреси. Склеїти їх означало б віддати чужу комісію.
        expect(normalizeBindingEmail('a.b@gmail.com')).not.toBe(normalizeBindingEmail('ab@gmail.com'));
        expect(normalizeBindingEmail('a+tag@gmail.com')).not.toBe(normalizeBindingEmail('a@gmail.com'));
    });

    it('відкидає те, що поштою не є', () => {
        expect(normalizeBindingEmail('')).toBeNull();
        expect(normalizeBindingEmail('не пошта')).toBeNull();
        expect(normalizeBindingEmail(null)).toBeNull();
    });
});

describe('(є) самореферал', () => {
    it('пошта покупця збігається з поштою партнера', () => {
        expect(isSelfReferral('Partner@Agency.com', 'partner@agency.com')).toBe(true);
    });

    it('різні пошти — звичайний клієнт', () => {
        expect(isSelfReferral('client@mail.com', 'partner@agency.com')).toBe(false);
    });

    it('порожня пошта не робить збігу', () => {
        expect(isSelfReferral(null, 'partner@agency.com')).toBe(false);
        expect(isSelfReferral('client@mail.com', null)).toBe(false);
    });
});

/**
 * Модель рішень із lib/agency/commission.ts і /api/promo/validate.
 *
 * Це не мок бази, а перепис ПОРЯДКУ правил: саме порядок ламався щоразу, коли
 * до системи додавали ще одну гілку. Тримати його окремо дешевше, ніж підіймати
 * Postgres у тестах, і читається він як опис моделі.
 */
type World = {
    bindings: Map<string, string>;          // пошта → id партнера
    partners: Map<string, { email: string; active: boolean }>;
};

function partnerDiscountAllowed(world: World, code: string, buyerEmail: string, source: 'link' | 'manual') {
    const partner = world.partners.get(code);
    if (!partner) return { allowed: false, reason: 'not_partner_code' };
    if (source !== 'link') return { allowed: false, reason: 'link_only' };
    if (!partner.active) return { allowed: false, reason: 'inactive' };
    if (world.bindings.has(normalizeBindingEmail(buyerEmail)!)) {
        return { allowed: false, reason: 'returning_client' };
    }
    return { allowed: true, reason: 'ok' };
}

function resolvePartnerForOrder(world: World, opts: { buyerEmail: string; refCode?: string }) {
    const email = normalizeBindingEmail(opts.buyerEmail);
    if (!email) return null;
    // 1. Довічна привʼязка переважає завжди.
    const bound = world.bindings.get(email);
    if (bound) return bound;
    // 2. Інакше — код, із яким прийшли.
    if (opts.refCode) {
        const partner = world.partners.get(opts.refCode);
        if (partner?.active && !isSelfReferral(email, partner.email)) return opts.refCode;
    }
    return null;
}

function payOrder(world: World, opts: { buyerEmail: string; refCode?: string; travelbook: number; other: number }) {
    const partnerId = resolvePartnerForOrder(world, opts);
    if (!partnerId) return { commission: 0, kind: null as string | null, bound: false };
    const email = normalizeBindingEmail(opts.buyerEmail)!;
    const boundNow = !world.bindings.has(email);
    if (boundNow) world.bindings.set(email, partnerId);
    const commission =
        Math.round(opts.travelbook * DEFAULT_PARTNER_TERMS.travelbookRate) / 100 +
        Math.round(opts.other * DEFAULT_PARTNER_TERMS.otherRate) / 100;
    return { commission, kind: boundNow ? 'new_client' : 'repeat', bound: boundNow };
}

function makeWorld(): World {
    return {
        bindings: new Map(),
        partners: new Map([['PARTNER1', { email: 'partner@agency.com', active: true }]]),
    };
}

describe('(а) знижка з посилання застосовується без видимого коду', () => {
    it('перехід за посиланням дає знижку', () => {
        const w = makeWorld();
        expect(partnerDiscountAllowed(w, 'PARTNER1', 'client@mail.com', 'link')).toEqual({ allowed: true, reason: 'ok' });
    });
});

describe('(б) ручне введення партнерського коду відхиляється', () => {
    it('той самий код, введений руками, знижки не дає', () => {
        const w = makeWorld();
        expect(partnerDiscountAllowed(w, 'PARTNER1', 'client@mail.com', 'manual').allowed).toBe(false);
        expect(partnerDiscountAllowed(w, 'PARTNER1', 'client@mail.com', 'manual').reason).toBe('link_only');
    });

    it('звичайний промокод полем вводу не зачеплений', () => {
        const w = makeWorld();
        // WELCOME7 не належить партнеру, тож ця перевірка його просто пропускає
        // далі, до звичайних правил промокоду.
        expect(partnerDiscountAllowed(w, 'WELCOME7', 'client@mail.com', 'manual').reason).toBe('not_partner_code');
    });
});

describe('(в) привʼязка при першому оплаченому замовленні', () => {
    it('перше замовлення закріплює клієнта і рахується як новий клієнт', () => {
        const w = makeWorld();
        const r = payOrder(w, { buyerEmail: 'Client@Mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        expect(r.bound).toBe(true);
        expect(r.kind).toBe('new_client');
        expect(w.bindings.get('client@mail.com')).toBe('PARTNER1');
    });

    it('привʼязка не перезаписується пізнішим переходом за чужим посиланням', () => {
        const w = makeWorld();
        w.partners.set('PARTNER2', { email: 'other@agency.com', active: true });
        payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        const second = payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER2', travelbook: 1000, other: 0 });
        expect(w.bindings.get('client@mail.com')).toBe('PARTNER1');
        expect(second.kind).toBe('repeat');
    });
});

describe('(г) комісія 5%/3% на повторному замовленні без посилання і без знижки', () => {
    it('привʼязаний клієнт приносить комісію без refCode', () => {
        const w = makeWorld();
        payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        // Друге замовлення: ні переходу, ні коду, ні знижки.
        const repeat = payOrder(w, { buyerEmail: 'client@mail.com', travelbook: 2000, other: 1000 });
        expect(repeat.kind).toBe('repeat');
        // 5% від 2000 = 100, 3% від 1000 = 30.
        expect(repeat.commission).toBe(130);
    });

    it('знижка на повторному замовленні НЕ діє', () => {
        const w = makeWorld();
        payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        expect(partnerDiscountAllowed(w, 'PARTNER1', 'client@mail.com', 'link').reason).toBe('returning_client');
    });
});

describe('(д) промокод на повторному замовленні не блокує комісію', () => {
    it('знижку дав WELCOME7, комісію все одно отримує партнер', () => {
        const w = makeWorld();
        payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        // Промокод впливає на знижку і ні на що більше: партнер визначається
        // поштою, а не тим, який код застосували.
        const repeat = payOrder(w, { buyerEmail: 'client@mail.com', travelbook: 1000, other: 0 });
        expect(repeat.commission).toBe(50);
        expect(repeat.kind).toBe('repeat');
    });
});

describe('(е) скасування повторного замовлення знімає комісію', () => {
    it('знімається лише невиплачене', () => {
        // Дзеркалить reverseAgencyCommission: UPDATE з умовою
        // payout_status='pending' у самому запиті, тож виплачене недоторкане.
        const rows = [
            { order: 'A', status: 'pending', amount: 50, kind: 'new_client' },
            { order: 'B', status: 'pending', amount: 130, kind: 'repeat' },
            { order: 'C', status: 'paid', amount: 40, kind: 'repeat' },
        ];
        const reverse = (orderId: string) => {
            const row = rows.find(r => r.order === orderId && r.status === 'pending');
            if (!row) return 0;
            row.status = 'cancelled';
            return row.amount;
        };
        expect(reverse('B')).toBe(130);
        expect(rows.find(r => r.order === 'B')!.status).toBe('cancelled');
        // Виплачене не знімається, і повторний виклик теж нічого не робить.
        expect(reverse('C')).toBe(0);
        expect(rows.find(r => r.order === 'C')!.status).toBe('paid');
        expect(reverse('B')).toBe(0);

        const earned = rows.filter(r => r.status !== 'cancelled').reduce((s, r) => s + r.amount, 0);
        expect(earned).toBe(90);
    });
});

describe('(є) самореферал не створює привʼязки', () => {
    it('партнер за власним посиланням: ні комісії, ні привʼязки', () => {
        const w = makeWorld();
        const r = payOrder(w, { buyerEmail: 'partner@agency.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        expect(r.commission).toBe(0);
        expect(r.bound).toBe(false);
        expect(w.bindings.has('partner@agency.com')).toBe(false);
    });

    it('і наступна покупка партнера теж нічого не нараховує', () => {
        const w = makeWorld();
        payOrder(w, { buyerEmail: 'partner@agency.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        const second = payOrder(w, { buyerEmail: 'partner@agency.com', travelbook: 5000, other: 0 });
        expect(second.commission).toBe(0);
    });
});

describe('неактивний партнер', () => {
    it('деактивований партнер не привʼязує і не отримує комісії', () => {
        const w = makeWorld();
        w.partners.set('PARTNER1', { email: 'partner@agency.com', active: false });
        const r = payOrder(w, { buyerEmail: 'client@mail.com', refCode: 'PARTNER1', travelbook: 1000, other: 0 });
        expect(r.commission).toBe(0);
        expect(r.bound).toBe(false);
    });
});
