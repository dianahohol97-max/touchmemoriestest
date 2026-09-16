import { describe, it, expect } from 'vitest';
import { partnerRefLink } from '@/lib/partners/referral-link';

describe('partnerRefLink', () => {
    it('кодує кириличний код', () => {
        // «ПОДОTABB» — живий код партнера «Подорожуй!».
        expect(partnerRefLink('ПОДОTABB')).toBe('https://touchmemories.com.ua/?ref=%D0%9F%D0%9E%D0%94%D0%9ETABB');
    });

    it('латинський код лишається читабельним', () => {
        expect(partnerRefLink('DIANPD3X')).toBe('https://touchmemories.com.ua/?ref=DIANPD3X');
    });

    it('пробіли обрізаються, порожнє не ламає посилання', () => {
        expect(partnerRefLink('  ABC  ')).toBe('https://touchmemories.com.ua/?ref=ABC');
        expect(partnerRefLink(null)).toBe('https://touchmemories.com.ua/?ref=');
    });
});
