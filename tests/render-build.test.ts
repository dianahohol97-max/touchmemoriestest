import { describe, expect, it } from 'vitest';
import { buildAgeDays, describeRenderBuild, shortCommit } from '@/lib/print/render-build';

/**
 * Сервіс рендеру живе на Railway окремо від сайту: пуш у main розкочує Vercel,
 * але не Railway. Виправлення може лежати в репозиторії тижнями і не працювати
 * в продакшні, і помітити це нема по чому.
 *
 * TM-001254: біла лінія по лінії різу лікується в clampCaptureEdge, комміт
 * лежав у репозиторії з шістнадцятого вересня, і три дні «перегенеруйте макет»
 * звучало як виправлення — хоча файли замовлення востаннє переписували
 * дев'ятого, тобто рендер не запускався взагалі.
 */
const NOW = new Date('2026-09-18T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400_000).toISOString();

describe('describeRenderBuild', () => {
    it('каже і збірку, і коли воно востаннє працювало', () => {
        const line = describeRenderBuild(
            { commit: '99e1379c1122334455', at: daysAgo(9), projectId: 'p', files: 28 },
            NOW,
        );
        expect(line).toContain('99e1379');
        expect(line).toContain('9 дн. тому');
    });

    it('саме вік, а не дата — «девʼять днів тому» читається як проблема', () => {
        expect(describeRenderBuild({ commit: 'a'.repeat(40), at: daysAgo(0), projectId: 'p', files: 1 }, NOW))
            .toContain('сьогодні');
        expect(describeRenderBuild({ commit: 'a'.repeat(40), at: daysAgo(1), projectId: 'p', files: 1 }, NOW))
            .toContain('учора');
    });

    it('порожньо — теж відповідь, і вона важлива', () => {
        expect(describeRenderBuild(null, NOW)).toContain('жодного рендеру');
    });

    it('невідома збірка називається вголос, а не ховається за порожнім рядком', () => {
        // RAILWAY_GIT_COMMIT_SHA не заданий — сервіс шле 'unknown'.
        expect(shortCommit('unknown')).toBe('невідома збірка');
        expect(shortCommit('')).toBe('невідома збірка');
        expect(shortCommit(null)).toBe('невідома збірка');
    });

    it('комміт ріжеться до семи знаків, як у git', () => {
        expect(shortCommit('99e1379c112233')).toBe('99e1379');
    });

    it('зіпсована дата не вигадує віку', () => {
        expect(buildAgeDays('хтозна')).toBeNull();
        expect(buildAgeDays(null)).toBeNull();
        expect(describeRenderBuild({ commit: 'abc1234', at: 'хтозна', projectId: 'p', files: 1 }, NOW))
            .toContain('невідомо коли');
    });
});
