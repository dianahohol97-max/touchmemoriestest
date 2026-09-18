import { describe, expect, it } from 'vitest';
import { buildAgeDays, describeRenderBuild, shortCommit } from '@/lib/print/render-build';

/**
 * Railway розкочується автоматично разом із GitHub, тож код сервісу рендеру
 * зазвичай свіжий. Питання, на яке не було відповіді, інше: чи рендер після
 * того виправлення взагалі ЗАПУСКАЛИ.
 *
 * TM-001254 через це чекало три дні. Виправлення білої лінії стояло на місці
 * з шістнадцятого вересня, а файли замовлення лишалися від дев'ятого: воно
 * змінює те, що рендер виробляє, і не чіпає готових файлів у сховищі. Тому
 * тут перевіряється насамперед ВІК останнього рендеру.
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
