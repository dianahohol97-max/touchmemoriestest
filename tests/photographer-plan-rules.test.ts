import { describe, expect, it } from 'vitest';
import {
    PLAN_RULES_FROM, isUnderPlanRules, termOptionsFor, canExtendGallery,
    canUploadVideo, isVideoFile, expiryLetterVariant, planOf,
} from '@/lib/photographers/plan-rules';

/**
 * Що дозволяє тариф у галереях (Diana, 2026-09-24): безкоштовний — 30 днів
 * без продовження і без відео; платні — 30/60/90, продовження, відео. Старі
 * галереї (створені до PLAN_RULES_FROM) продовжуються як раніше.
 */

const DAY = 86_400_000;
const before = new Date(new Date(PLAN_RULES_FROM).getTime() - 1).toISOString();
const after = new Date(new Date(PLAN_RULES_FROM).getTime() + DAY).toISOString();

describe('тариф у силі', () => {
    const now = Date.now();
    it('оплачений тариф до кінця строку — він сам; після — безкоштовний', () => {
        expect(planOf({ plan: 'pro', plan_expires_at: new Date(now + DAY).toISOString() })).toBe('pro');
        expect(planOf({ plan: 'pro', plan_expires_at: new Date(now - DAY).toISOString() })).toBe('free');
        expect(planOf({ plan: null })).toBe('free');
    });
});

describe('термін при створенні', () => {
    it('безкоштовний — лише 30 днів', () => {
        expect(termOptionsFor('free')).toEqual([30]);
    });
    it('платні — 30, 60, 90', () => {
        for (const p of ['start', 'pro', 'studio'] as const) expect(termOptionsFor(p)).toEqual([30, 60, 90]);
    });
});

describe('продовження', () => {
    it('нова галерея на безкоштовному тарифі — ні', () => {
        expect(canExtendGallery('free', after)).toBe(false);
        expect(canExtendGallery('free', PLAN_RULES_FROM)).toBe(false);
    });
    it('стара галерея на безкоштовному тарифі — так, як і до рішення', () => {
        expect(canExtendGallery('free', before)).toBe(true);
        // Галерея Ірини Владової, лист їй піде 03.10.
        expect(canExtendGallery('free', '2026-09-06T15:31:31.375Z')).toBe(true);
    });
    it('будь-яка галерея на платному тарифі — так', () => {
        for (const p of ['start', 'pro', 'studio'] as const) {
            expect(canExtendGallery(p, after)).toBe(true);
            expect(canExtendGallery(p, before)).toBe(true);
        }
    });
    it('дата створення невідома — рахуємо новою (суворіше)', () => {
        expect(isUnderPlanRules(null)).toBe(true);
        expect(isUnderPlanRules('не дата')).toBe(true);
        expect(canExtendGallery('free', undefined)).toBe(false);
    });
});

describe('відео', () => {
    it('безкоштовний — ні, платні — так', () => {
        expect(canUploadVideo('free')).toBe(false);
        for (const p of ['start', 'pro', 'studio'] as const) expect(canUploadVideo(p)).toBe(true);
    });

    it('відео розпізнається за типом', () => {
        expect(isVideoFile({ contentType: 'video/mp4', fileName: 'clip' })).toBe(true);
        expect(isVideoFile({ contentType: 'video/quicktime', fileName: 'IMG_0001.MOV' })).toBe(true);
    });

    it('відео з типом фото все одно відео, бо розширення каже інше', () => {
        expect(isVideoFile({ contentType: 'image/jpeg', fileName: 'wedding.mp4' })).toBe(true);
        expect(isVideoFile({ contentType: '', fileName: 'IMG_0420.MOV' })).toBe(true);
        expect(isVideoFile({ fileName: 'film.webm' })).toBe(true);
    });

    it('фото лишаються фото, зокрема HEIC і файли без розширення', () => {
        expect(isVideoFile({ contentType: 'image/jpeg', fileName: 'IMG_0001.JPG' })).toBe(false);
        expect(isVideoFile({ contentType: 'image/heic', fileName: 'IMG_0002.HEIC' })).toBe(false);
        expect(isVideoFile({ contentType: 'image/png', fileName: 'scan' })).toBe(false);
        expect(isVideoFile({ contentType: 'image/jpeg', fileName: 'mp4.jpg' })).toBe(false);
    });
});

describe('варіант листа «галерея скоро згасне»', () => {
    it('обіцяє продовження рівно там, де його прийме сервер', () => {
        expect(expiryLetterVariant('free', before)).toBe('extend');
        expect(expiryLetterVariant('free', after)).toBe('upgrade');
        expect(expiryLetterVariant('start', after)).toBe('extend');
        for (const plan of ['free', 'start', 'pro', 'studio'] as const) {
            for (const created of [before, after]) {
                expect(expiryLetterVariant(plan, created) === 'extend').toBe(canExtendGallery(plan, created));
            }
        }
    });
});
